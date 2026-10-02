import { describe, expect, it } from "vitest";
import {
  buildIncomeFlow,
  priorPeriod,
  type FlowLink,
  type IncomeFlow,
  type StoredStatement,
} from "@/lib/income-visual/model";
import { layoutIncomeFlow } from "@/lib/income-visual/layout";
import { money, shortCompanyName, signedPct } from "@/lib/income-visual/format";
import { incomeVisualFrom, incomeVisualPostText } from "@/lib/income-visual/visual";
import { containsUrl, countChars } from "@/lib/x-client";

function statement(
  data: Record<string, number>,
  over: Partial<StoredStatement> = {},
): StoredStatement {
  return {
    period_type: "quarter",
    period: "2026-06-27",
    fiscal_year: "2026",
    fiscal_period: "Q3",
    fiscal_label: "Q3 FY26",
    accepted_date: "2026-07-31",
    segments: null,
    ...over,
    data: { reportedCurrency: "USD" as unknown as number, ...data },
  };
}

/** Apple Q3 FY26 as FMP reports it. */
const APPLE = statement({
  revenue: 109_417e6,
  costOfRevenue: 54_647e6,
  grossProfit: 54_770e6,
  researchAndDevelopmentExpenses: 11_729e6,
  sellingGeneralAndAdministrativeExpenses: 7_346e6,
  operatingExpenses: 19_075e6,
  operatingIncome: 35_695e6,
  incomeTaxExpense: 6_478e6,
  netIncome: 29_789e6,
});

function outflow(flow: IncomeFlow, id: string): number {
  return flow.links.filter((l) => l.source === id).reduce((s, l) => s + l.value, 0);
}
function inflow(flow: IncomeFlow, id: string): number {
  return flow.links.filter((l) => l.target === id).reduce((s, l) => s + l.value, 0);
}
function node(flow: IncomeFlow, id: string) {
  return flow.nodes.find((n) => n.id === id);
}

describe("buildIncomeFlow", () => {
  it("balances every interior node", () => {
    const flow = buildIncomeFlow(APPLE, null)!;
    for (const id of ["revenue", "gross", "operating", "opex"]) {
      const n = node(flow, id)!;
      const ins = id === "revenue" ? n.flow : inflow(flow, id);
      expect(outflow(flow, id)).toBeCloseTo(ins, 0);
    }
  });

  it("routes positive non-operating income into net profit", () => {
    // Apple: operating 35.7B + other 0.57B - tax 6.48B = net 29.79B.
    const flow = buildIncomeFlow(APPLE, null)!;
    const other = node(flow, "other_income")!;
    expect(other.value).toBeCloseTo(572e6, -5);
    expect(inflow(flow, "net")).toBeCloseTo(29_789e6, -5);
    expect(inflow(flow, "tax")).toBeCloseTo(6_478e6, -5);
    expect(node(flow, "other")).toBeUndefined();
  });

  it("draws non-operating costs as an outflow", () => {
    const flow = buildIncomeFlow(
      statement({ ...APPLE.data, netIncome: 28_000e6 } as Record<string, number>),
      null,
    )!;
    expect(node(flow, "other")!.value).toBeCloseTo(35_695e6 - 6_478e6 - 28_000e6, -5);
    expect(node(flow, "other_income")).toBeUndefined();
  });

  it("splits operating expenses only into line items that fit", () => {
    const flow = buildIncomeFlow(APPLE, null)!;
    expect(node(flow, "rd")!.value).toBe(11_729e6);
    expect(node(flow, "sga")!.value).toBe(7_346e6);

    // R&D + SG&A larger than the derived total: no split, never a negative "Other".
    const odd = buildIncomeFlow(
      statement({ ...APPLE.data, researchAndDevelopmentExpenses: 30_000e6 } as Record<string, number>),
      null,
    )!;
    expect(node(odd, "rd")).toBeUndefined();
    expect(odd.nodes.every((n) => n.value >= 0 || n.kind === "loss")).toBe(true);
  });

  it("does not split opex into a single child", () => {
    const flow = buildIncomeFlow(
      statement({
        revenue: 100,
        costOfRevenue: 80,
        grossProfit: 20,
        sellingGeneralAndAdministrativeExpenses: 15,
        operatingIncome: 5,
        incomeTaxExpense: 1,
        netIncome: 4,
      }),
      null,
    )!;
    expect(node(flow, "sga")).toBeUndefined();
  });

  it("feeds operating lines from revenue when there is no cost of revenue", () => {
    const flow = buildIncomeFlow(
      statement({ revenue: 100, costOfRevenue: 0, operatingIncome: 30, incomeTaxExpense: 6, netIncome: 24 }),
      null,
    )!;
    expect(node(flow, "gross")).toBeUndefined();
    expect(flow.links.find((l) => l.source === "revenue" && l.target === "operating")?.value).toBe(30);
    expect(flow.metrics.grossMargin).toBeNull();
  });

  it("marks losses without drawing a flow for them", () => {
    const flow = buildIncomeFlow(
      statement({
        revenue: 1_700e6,
        costOfRevenue: 1_521e6,
        grossProfit: 179e6,
        researchAndDevelopmentExpenses: 466e6,
        sellingGeneralAndAdministrativeExpenses: 485e6,
        operatingIncome: -836e6,
        incomeTaxExpense: 1e6,
        netIncome: -833e6,
      }),
      null,
    )!;
    const op = node(flow, "operating")!;
    expect(op.kind).toBe("loss");
    expect(op.flow).toBe(0);
    expect(node(flow, "net")!.label).toBe("Net loss");
    // All of gross profit is consumed; opex is labelled at its reported size.
    expect(node(flow, "opex")!.flow).toBeCloseTo(179e6, -3);
    expect(node(flow, "opex")!.value).toBeCloseTo(1_015e6, -3);
    expect(flow.links.every((l: FlowLink) => l.value > 0)).toBe(true);
  });

  it("draws a segment column only when the segments add up to revenue", () => {
    const withSegs = buildIncomeFlow(
      statement({ ...APPLE.data } as Record<string, number>, {
        segments: { iPhone: 60_000e6, Services: 30_000e6, Mac: 19_417e6 },
      }),
      null,
    )!;
    expect(withSegs.hasSegments).toBe(true);
    expect(withSegs.columns).toBe(5);
    expect(inflow(withSegs, "revenue")).toBeCloseTo(109_417e6, -5);

    const partial = buildIncomeFlow(
      statement({ ...APPLE.data } as Record<string, number>, {
        segments: { iPhone: 60_000e6, Services: 30_000e6 },
      }),
      null,
    )!;
    expect(partial.hasSegments).toBe(false);
  });

  it("folds segments past the cap into Other", () => {
    const segments = Object.fromEntries(
      Array.from({ length: 8 }, (_, i) => [`S${i}`, 100 - i]),
    );
    const revenue = Object.values(segments).reduce((s, v) => s + v, 0);
    const flow = buildIncomeFlow(
      statement({ revenue, costOfRevenue: revenue / 2, grossProfit: revenue / 2, operatingIncome: revenue / 4, netIncome: revenue / 5, incomeTaxExpense: revenue / 20 }, { segments }),
      null,
    )!;
    const segs = flow.nodes.filter((n) => n.id.startsWith("seg:"));
    expect(segs).toHaveLength(6);
    expect(segs.at(-1)!.label).toBe("Other");
  });

  it("computes Y/Y against the same fiscal period a year earlier", () => {
    const prior = statement(
      { revenue: 100e9, costOfRevenue: 50e9, grossProfit: 50e9, operatingIncome: 30e9, incomeTaxExpense: 5e9, netIncome: 25e9 },
      { period: "2025-06-28", fiscal_year: "2025" },
    );
    const flow = buildIncomeFlow(APPLE, prior)!;
    expect(node(flow, "revenue")!.yoy).toBeCloseTo(0.09417, 4);
    expect(flow.metrics.grossMarginPriorPp).toBeCloseTo((54_770 / 109_417 - 0.5) * 100, 3);
  });

  it("skips Y/Y on derived lines when last year had no gross split", () => {
    const prior = statement(
      { revenue: 1_300e6, costOfRevenue: 1_500e6, grossProfit: -200e6, operatingIncome: -1_100e6, netIncome: -1_100e6 },
      { period: "2025-06-30", fiscal_year: "2025" },
    );
    const cur = statement(
      { revenue: 1_700e6, costOfRevenue: 1_521e6, grossProfit: 179e6, researchAndDevelopmentExpenses: 466e6, sellingGeneralAndAdministrativeExpenses: 485e6, operatingIncome: -836e6, netIncome: -833e6 },
      { period: "2026-06-30", fiscal_year: "2026" },
    );
    const flow = buildIncomeFlow(cur, prior)!;
    expect(node(flow, "opex")!.yoy).toBeNull();
    expect(node(flow, "revenue")!.yoy).not.toBeNull();
  });

  it("refuses a statement with no revenue", () => {
    expect(buildIncomeFlow(statement({ revenue: 0 }), null)).toBeNull();
  });
});

describe("priorPeriod", () => {
  const rows = [
    statement({ revenue: 1 }, { period: "2026-06-27", fiscal_year: "2026", fiscal_period: "Q3" }),
    statement({ revenue: 1 }, { period: "2026-03-28", fiscal_year: "2026", fiscal_period: "Q2" }),
    statement({ revenue: 1 }, { period: "2025-06-28", fiscal_year: "2025", fiscal_period: "Q3" }),
  ];

  it("matches fiscal period and year", () => {
    expect(priorPeriod(rows[0], rows)?.period).toBe("2025-06-28");
  });

  it("falls back to a period end about a year earlier", () => {
    const unlabeled = rows.map((r) => ({ ...r, fiscal_period: null }));
    expect(priorPeriod(unlabeled[0], unlabeled)?.period).toBe("2025-06-28");
  });

  it("returns null when last year is not stored", () => {
    expect(priorPeriod(rows[1], rows)).toBeNull();
  });
});

describe("layoutIncomeFlow", () => {
  const options = {
    width: 984,
    height: 690,
    nodeWidth: 20,
    sideLabelWidth: 176,
    labelHeight: () => 64,
    gap: 12,
    spread: 26,
  };

  it("keeps every node and its label slot inside the canvas without overlaps", () => {
    const flow = buildIncomeFlow(APPLE, null)!;
    const layout = layoutIncomeFlow(flow, options);
    expect(layout.nodes).toHaveLength(flow.nodes.length);
    const byColumn = new Map<number, typeof layout.nodes>();
    for (const n of layout.nodes) {
      const slotTop = n.y + n.h / 2 - Math.max(n.h, 64) / 2;
      const slotBottom = slotTop + Math.max(n.h, 64);
      expect(slotTop).toBeGreaterThanOrEqual(-0.5);
      expect(slotBottom).toBeLessThanOrEqual(options.height + 0.5);
      byColumn.set(n.column, [...(byColumn.get(n.column) ?? []), n]);
    }
    for (const column of byColumn.values()) {
      const slots = column
        .map((n) => [n.y + n.h / 2 - Math.max(n.h, 64) / 2, n.y + n.h / 2 + Math.max(n.h, 64) / 2])
        .sort((a, b) => a[0] - b[0]);
      for (let i = 1; i < slots.length; i++) {
        expect(slots[i][0]).toBeGreaterThanOrEqual(slots[i - 1][1] - 0.5);
      }
    }
  });

  it("puts profit above cost in each column", () => {
    const layout = layoutIncomeFlow(buildIncomeFlow(APPLE, null)!, options);
    const y = (id: string) => layout.nodes.find((n) => n.id === id)!.y;
    expect(y("gross")).toBeLessThan(y("cogs"));
    expect(y("operating")).toBeLessThan(y("opex"));
    expect(y("net")).toBeLessThan(y("tax"));
    expect(y("tax")).toBeLessThan(y("rd"));
  });

  it("emits one closed path per link", () => {
    const flow = buildIncomeFlow(APPLE, null)!;
    const layout = layoutIncomeFlow(flow, options);
    expect(layout.links).toHaveLength(flow.links.length);
    expect(layout.links.every((l) => l.d.startsWith("M") && l.d.endsWith("Z"))).toBe(true);
  });
});

describe("incomeVisualPostText", () => {
  const prior = statement(
    { revenue: 100e9, costOfRevenue: 50e9, grossProfit: 50e9, operatingIncome: 30e9, incomeTaxExpense: 5e9, netIncome: 25e9 },
    { period: "2025-06-28", fiscal_year: "2025" },
  );
  const payload = {
    ticker: "AAPL",
    name: "Apple Inc.",
    sector: null,
    held: false,
    period_type: "quarter" as const,
    statements: [APPLE, prior],
  };

  it("states only figures the image draws, with no link", () => {
    const text = incomeVisualPostText(incomeVisualFrom(payload)!);
    expect(text).toBe(
      [
        "$AAPL Q3 FY26 income statement",
        "",
        "Revenue $109B (+9.4% Y/Y)",
        "Gross margin 50% (+0.1pp)",
        "Operating margin 33% (+2.6pp)",
        "Net income $29.8B (+19% Y/Y)",
      ].join("\n"),
    );
    expect(containsUrl(text)).toBe(false);
    expect(countChars(text)).toBeLessThanOrEqual(280);
  });

  it("drops the comparison when last year is not stored", () => {
    const text = incomeVisualPostText(incomeVisualFrom({ ...payload, statements: [APPLE] })!);
    expect(text).toContain("Revenue $109B\n");
    expect(text).not.toMatch(/Y\/Y|pp/);
  });
});

describe("format", () => {
  it("formats money compactly", () => {
    expect(money(109_417e6)).toBe("$109B");
    expect(money(54_770e6)).toBe("$54.8B");
    expect(money(-836e6)).toBe("-$836M");
    expect(money(50e6)).toBe("$50.0M");
  });

  it("signs percentages", () => {
    expect(signedPct(0.0941)).toBe("+9.4%");
    expect(signedPct(-0.25)).toBe("-25%");
    expect(signedPct(0)).toBe("+0%");
  });

  it("drops corporate suffixes from company names", () => {
    expect(shortCompanyName("Micron Technology, Inc.", "MU")).toBe("Micron Technology");
    expect(shortCompanyName("JPMorgan Chase & Co.", "JPM")).toBe("JPMorgan Chase");
    expect(shortCompanyName("Eli Lilly and Company", "LLY")).toBe("Eli Lilly");
    expect(shortCompanyName(null, "MU")).toBe("MU");
  });
});
