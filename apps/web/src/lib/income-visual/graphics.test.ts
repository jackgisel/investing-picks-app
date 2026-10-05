import { describe, expect, it } from "vitest";
import { buildIncomeFlow, type StoredStatement } from "@/lib/income-visual/model";
import { incomeVisualFrom, incomeVisualPostText } from "@/lib/income-visual/visual";
import {
  etDateKey,
  incomeImagePlan,
  isFridayDraftWindow,
  quarterStrip,
  segmentMix,
  surpriseFor,
  weekPostText,
  weekRanks,
  workforcePostText,
  workforceSelection,
  WEEK_MIN,
  type EarningsPrint,
  type WeekEntry,
} from "@/lib/income-visual/graphics";
import { themeOf } from "@/lib/income-visual/themes";
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
    data: { reportedCurrency: "USD", ...data },
  };
}

const CURRENT = statement({
  revenue: 100e9,
  costOfRevenue: 40e9,
  grossProfit: 60e9,
  operatingIncome: 30e9,
  incomeTaxExpense: 5e9,
  netIncome: 25e9,
});

describe("themes", () => {
  it("names the groups we post and ignores the rest of the market", () => {
    expect(themeOf("nvda")).toBe("Semiconductors");
    expect(themeOf("GOOG")).toBe("Platforms");
    expect(themeOf("VST")).toBe("Energy and power");
    expect(themeOf("MOD")).toBe("AI infrastructure");
    expect(themeOf("JPM")).toBeNull();
    expect(themeOf("NKE")).toBeNull();
  });
});

describe("surpriseFor", () => {
  const earnings: EarningsPrint[] = [
    {
      date: "2026-07-30",
      eps_actual: 1.2,
      eps_estimated: 1,
      revenue_actual: 110e9,
      revenue_estimated: 100e9,
    },
    {
      date: "2025-01-01",
      eps_actual: 9,
      eps_estimated: 1,
      revenue_actual: null,
      revenue_estimated: null,
    },
  ];

  it("uses the print nearest the filing and ignores an older one", () => {
    const surprise = surpriseFor(CURRENT, earnings);
    expect(surprise?.eps).toBeCloseTo(0.2);
    expect(surprise?.revenue).toBeCloseTo(0.1);
  });

  it("returns null when the estimate was never stored", () => {
    expect(
      surpriseFor(CURRENT, [
        {
          date: "2026-07-30",
          eps_actual: 1.2,
          eps_estimated: null,
          revenue_actual: null,
          revenue_estimated: null,
        },
      ]),
    ).toBeNull();
  });
});

describe("quarterStrip", () => {
  it("keeps eight quarters, oldest first", () => {
    const statements = Array.from({ length: 10 }, (_, i) =>
      statement(
        { revenue: (i + 1) * 1e9, operatingIncome: (i + 1) * 0.2e9 },
        {
          period: `2026-0${(i % 9) + 1}-01`,
          fiscal_period: `Q${(i % 4) + 1}`,
          fiscal_label: `Q${i}`,
        },
      ),
    );
    const strip = quarterStrip(statements);
    expect(strip).toHaveLength(8);
    expect(strip[0].revenue).toBe(8e9);
    expect(strip[7].revenue).toBe(1e9);
    expect(strip[7].operatingMargin).toBeCloseTo(0.2);
  });
});

describe("segmentMix", () => {
  it("compares segment share with last year", () => {
    const current = statement(
      { revenue: 100, operatingIncome: 20, netIncome: 10 },
      { period_type: "annual", segments: { DRAM: 80, NAND: 20 }, fiscal_period: "FY" },
    );
    const prior = statement(
      { revenue: 80, operatingIncome: 10, netIncome: 5 },
      {
        period: "2025-06-27",
        fiscal_year: "2025",
        period_type: "annual",
        segments: { DRAM: 40, NAND: 40 },
        fiscal_period: "FY",
      },
    );
    const rows = segmentMix(buildIncomeFlow(current, prior)!, buildIncomeFlow(prior, null));
    expect(rows?.map((r) => r.name)).toEqual(["DRAM", "NAND"]);
    expect(rows?.[0].share).toBeCloseTo(0.8);
    expect(rows?.[0].priorShare).toBeCloseTo(0.5);
  });
});

describe("weekRanks", () => {
  function entry(ticker: string, revenueYoy: number, extra: Partial<WeekEntry> = {}): WeekEntry {
    return { ticker, revenueYoy, operatingMarginPp: null, epsSurprise: null, ...extra };
  }

  it("skips a week with fewer than four prints", () => {
    expect(weekRanks([entry("NVDA", 0.2), entry("AMD", 0.1), entry("AVGO", 0)])).toBeNull();
  });

  it("ranks revenue and keeps the largest beat and miss", () => {
    const ranks = weekRanks([
      entry("NVDA", 1.2, { operatingMarginPp: 3, epsSurprise: 0.08 }),
      entry("AMD", 0.3, { operatingMarginPp: -1, epsSurprise: -0.04 }),
      entry("AVGO", 0.1, { operatingMarginPp: 0.5 }),
      entry("INTC", -0.2, { operatingMarginPp: -4, epsSurprise: -0.2 }),
      entry("MU", 0.5),
    ]);
    expect(ranks?.revenue.map((r) => r.ticker)).toEqual(["NVDA", "MU", "AMD", "AVGO", "INTC"]);
    expect(ranks?.beat).toEqual({ ticker: "NVDA", value: 0.08 });
    expect(ranks?.miss).toEqual({ ticker: "INTC", value: -0.2 });
    const text = weekPostText(ranks!);
    expect(containsUrl(text)).toBe(false);
    expect(countChars(text)).toBeLessThanOrEqual(280);
    expect(text).toContain("$NVDA revenue +120% Y/Y");
    expect(text).toContain("$INTC");
  });

  it("needs at least four names with revenue per employee", () => {
    const thin = Array.from({ length: WEEK_MIN - 1 }, (_, i) => ({
      ticker: `T${i}`,
      name: null,
      rev_per_employee: 1e6,
      leverage: 0.1,
      openings_per_1000: 10,
      openings_change_90d: 0.5,
    }));
    expect(workforceSelection(thin)).toBeNull();
  });
});

describe("workforceSelection", () => {
  it("ranks productivity and only calls out a large hiring move", () => {
    const rows = ["NVDA", "AMD", "AVGO", "TSM", "ASML"].map((ticker, i) => ({
      ticker,
      name: ticker,
      rev_per_employee: (5 - i) * 1e6,
      leverage: i === 0 ? 0.4 : -0.05,
      openings_per_1000: 20,
      openings_change_90d: i === 1 ? 0.4 : 0.05,
    }));
    const selection = workforceSelection(rows);
    expect(selection?.productivity[0].ticker).toBe("NVDA");
    expect(selection?.leverage[0].ticker).toBe("NVDA");
    expect(selection?.hiring.map((r) => r.ticker)).toEqual(["AMD"]);
    const text = workforcePostText(selection!);
    expect(containsUrl(text)).toBe(false);
    expect(countChars(text)).toBeLessThanOrEqual(280);
    expect(text).toContain("$NVDA");
    expect(text).toContain("$AMD openings");
  });
});

describe("income captions", () => {
  it("adds the surprise without a link and stays within the post limit", () => {
    const prior = statement(
      { revenue: 80e9, costOfRevenue: 32e9, grossProfit: 48e9, operatingIncome: 20e9, netIncome: 16e9 },
      { period: "2025-06-28", fiscal_year: "2025" },
    );
    const visual = incomeVisualFrom({
      ticker: "NVDA",
      name: "NVIDIA",
      sector: null,
      held: false,
      period_type: "quarter",
      statements: [CURRENT, prior],
    })!;
    const text = incomeVisualPostText(visual, { surprise: { eps: 0.08, revenue: 0.03 } });
    expect(text).toContain("EPS +8% vs estimate");
    expect(text).toContain("Revenue +3% vs estimate");
    expect(containsUrl(text)).toBe(false);
    expect(countChars(text)).toBeLessThanOrEqual(280);
    expect(
      incomeImagePlan({ periodType: "quarter", strip: true, mix: false, surprise: true }),
    ).toEqual(["sankey"]);
    expect(
      incomeImagePlan({ periodType: "annual", strip: true, mix: true, surprise: false }),
    ).toEqual(["mix"]);
  });
});

describe("Friday window", () => {
  it("opens Friday at 16:00 US Eastern", () => {
    expect(isFridayDraftWindow(new Date("2026-10-02T20:30:00Z"))).toBe(true);
    expect(isFridayDraftWindow(new Date("2026-10-02T19:30:00Z"))).toBe(false);
    expect(isFridayDraftWindow(new Date("2026-10-03T20:30:00Z"))).toBe(false);
    expect(etDateKey(new Date("2026-10-03T03:30:00Z"))).toBe("2026-10-02");
  });
});
