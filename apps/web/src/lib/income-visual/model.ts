/**
 * Income statement → Sankey flow.
 *
 * Every number here is a reported line item or a difference of two of them.
 * The diagram has to balance — what leaves a node equals what entered it — so
 * where the vendor's own subtotals disagree (FMP's `operatingExpenses` does not
 * always equal gross profit minus operating income) the flow is derived from
 * the subtotals that bracket it, and the line items are only used to split it.
 *
 * Losses do not flow. A node whose value is negative is drawn as a labelled
 * marker with no link, because a negative-width band is not a picture of
 * anything and a positive one would misstate the sign.
 */

export type PeriodType = "quarter" | "annual";

export type StoredStatement = {
  period_type: PeriodType;
  /** Fiscal period end, ISO date. */
  period: string;
  fiscal_year: string | null;
  fiscal_period: string | null;
  fiscal_label: string;
  accepted_date: string | null;
  data: Record<string, unknown>;
  segments: Record<string, number> | null;
};

export type NodeKind = "revenue" | "profit" | "cost" | "loss";

export type FlowNode = {
  id: string;
  label: string;
  /** Reported value. Negative only for `loss` markers. */
  value: number;
  /** Drawn magnitude; 0 for markers. */
  flow: number;
  kind: NodeKind;
  column: number;
  yoy: number | null;
  /** Share of revenue, shown under profit lines. */
  margin: number | null;
};

export type FlowLink = { source: string; target: string; value: number };

export type IncomeFlow = {
  nodes: FlowNode[];
  links: FlowLink[];
  columns: number;
  revenue: number;
  currency: string;
  hasSegments: boolean;
  metrics: {
    revenueYoy: number | null;
    grossMargin: number | null;
    grossMarginPriorPp: number | null;
    operatingMargin: number | null;
    operatingMarginPriorPp: number | null;
    netMargin: number | null;
    netMarginPriorPp: number | null;
    netIncome: number;
    netIncomeYoy: number | null;
  };
};

/** Segment columns past this many are folded into "Other". */
export const MAX_SEGMENTS = 5;
/** Segments must add up to revenue within this tolerance to be drawn. */
const SEGMENT_TOLERANCE = 0.05;

function num(data: Record<string, unknown>, key: string): number {
  const v = data[key];
  return typeof v === "number" && Number.isFinite(v) ? v : 0;
}

/** Same period a year earlier, or null when it is not stored. */
export function priorPeriod(
  current: StoredStatement,
  statements: StoredStatement[],
): StoredStatement | null {
  const others = statements.filter((s) => s.period !== current.period);
  const fy = Number(current.fiscal_year);
  if (current.fiscal_period && Number.isFinite(fy)) {
    const match = others.find(
      (s) =>
        s.fiscal_period === current.fiscal_period &&
        Number(s.fiscal_year) === fy - 1,
    );
    if (match) return match;
  }
  // Fiscal labels missing or renumbered: fall back to a period end roughly a
  // year earlier.
  const end = Date.parse(current.period);
  return (
    others.find((s) => {
      const days = (end - Date.parse(s.period)) / 86_400_000;
      return days > 330 && days < 400;
    }) ?? null
  );
}

function growth(current: number, prior: number | undefined): number | null {
  if (prior === undefined || prior <= 0 || current < 0) return null;
  return (current - prior) / prior;
}

type Built = {
  nodes: FlowNode[];
  links: FlowLink[];
  revenue: number;
  grossProfit: number | null;
  operatingIncome: number;
  netIncome: number;
  hasSegments: boolean;
};

function segmentEntries(
  segments: Record<string, number> | null,
  revenue: number,
): [string, number][] | null {
  if (!segments) return null;
  const entries = Object.entries(segments).filter(([, v]) => v > 0);
  if (entries.length < 2) return null;
  const total = entries.reduce((s, [, v]) => s + v, 0);
  if (Math.abs(total - revenue) / revenue > SEGMENT_TOLERANCE) return null;
  entries.sort((a, b) => b[1] - a[1]);
  if (entries.length <= MAX_SEGMENTS + 1) return entries;
  const head = entries.slice(0, MAX_SEGMENTS);
  const rest = entries.slice(MAX_SEGMENTS).reduce((s, [, v]) => s + v, 0);
  return [...head, ["Other", rest]];
}

function build(st: StoredStatement): Built | null {
  const d = st.data;
  const revenue = num(d, "revenue");
  if (revenue <= 0) return null;

  const nodes: FlowNode[] = [];
  const links: FlowLink[] = [];
  const node = (n: Omit<FlowNode, "yoy" | "margin">) => {
    nodes.push({ ...n, yoy: null, margin: null });
  };
  const link = (source: string, target: string, value: number) => {
    if (value > 0) links.push({ source, target, value });
  };

  const segs = segmentEntries(st.segments, revenue);
  const c0 = segs ? 1 : 0;
  if (segs) {
    // Scale each band so they sum to revenue exactly; the label keeps the
    // reported figure.
    const total = segs.reduce((s, [, v]) => s + v, 0);
    for (const [name, value] of segs) {
      const id = `seg:${name}`;
      node({ id, label: name, value, flow: (value * revenue) / total, kind: "revenue", column: 0 });
      link(id, "revenue", (value * revenue) / total);
    }
  }
  node({ id: "revenue", label: "Revenue", value: revenue, flow: revenue, kind: "revenue", column: c0 });

  // Gross profit split. Banks and insurers report no cost of revenue (or one
  // larger than revenue); for them revenue feeds operating lines directly.
  const cogs = num(d, "costOfRevenue");
  const reportedGross = num(d, "grossProfit") || revenue - cogs;
  const hasGross = cogs > 0 && reportedGross > 0 && reportedGross < revenue;
  let base = revenue;
  let baseId = "revenue";
  let col = c0 + 1;
  if (hasGross) {
    const gross = reportedGross;
    node({ id: "gross", label: "Gross profit", value: gross, flow: gross, kind: "profit", column: col });
    node({ id: "cogs", label: "Cost of revenue", value: revenue - gross, flow: revenue - gross, kind: "cost", column: col });
    link("revenue", "gross", gross);
    link("revenue", "cogs", revenue - gross);
    base = gross;
    baseId = "gross";
    col += 1;
  }

  const operatingIncome = num(d, "operatingIncome");
  const opex = base - operatingIncome;
  const opCol = col;
  const netCol = col + 1;

  if (operatingIncome > 0) {
    node({ id: "operating", label: "Operating profit", value: operatingIncome, flow: operatingIncome, kind: "profit", column: opCol });
    link(baseId, "operating", operatingIncome);
  }
  if (opex > 0) {
    const opexFlow = Math.min(opex, base);
    node({ id: "opex", label: "Operating expenses", value: opex, flow: opexFlow, kind: "cost", column: opCol });
    link(baseId, "opex", opexFlow);

    const rd = num(d, "researchAndDevelopmentExpenses");
    const sga =
      num(d, "sellingGeneralAndAdministrativeExpenses") ||
      num(d, "generalAndAdministrativeExpenses") + num(d, "sellingAndMarketingExpenses");
    const parts: [string, string, number][] = [];
    if (rd > 0) parts.push(["rd", "R&D", rd]);
    if (sga > 0) parts.push(["sga", "SG&A", sga]);
    const named = rd + sga;
    // Only split when the line items fit inside the derived total; when they
    // do not, the vendor has classified something differently and a split
    // would invent a negative "other".
    const other = opex - named;
    if (other > opex * 0.02) parts.push(["opex_other", "Other", other]);
    // A single child is the parent again under another name.
    if (parts.length >= 2 && named <= opex * 1.02) {
      const scale = opexFlow / parts.reduce((s, [, , v]) => s + v, 0);
      for (const [id, label, value] of parts) {
        node({ id, label, value, flow: value * scale, kind: "cost", column: netCol });
        link("opex", id, value * scale);
      }
    }
  }
  if (operatingIncome <= 0) {
    node({ id: "operating", label: "Operating loss", value: operatingIncome, flow: 0, kind: "loss", column: opCol });
  }

  const netIncome = num(d, "netIncome");
  const tax = Math.max(num(d, "incomeTaxExpense"), 0);
  if (operatingIncome > 0) {
    // other > 0: non-operating costs out of operating profit.
    // other < 0: non-operating income joining it on the way to net profit.
    const fromOpToTax = Math.min(tax, operatingIncome);
    const other = operatingIncome - tax - netIncome;
    if (netIncome > 0) {
      node({ id: "net", label: "Net profit", value: netIncome, flow: netIncome, kind: "profit", column: netCol });
    } else {
      node({ id: "net", label: "Net loss", value: netIncome, flow: 0, kind: "loss", column: netCol });
    }
    if (tax > 0) node({ id: "tax", label: "Tax", value: tax, flow: tax, kind: "cost", column: netCol });
    link("operating", "tax", fromOpToTax);

    if (other < 0 && netIncome > 0) {
      const inflow = -other;
      node({ id: "other_income", label: "Other income", value: inflow, flow: inflow, kind: "profit", column: opCol });
      const opToNet = operatingIncome - fromOpToTax;
      link("operating", "net", opToNet);
      link("other_income", "net", netIncome - opToNet);
      link("other_income", "tax", tax - fromOpToTax);
    } else {
      const toNet = Math.max(netIncome, 0);
      const otherOut = operatingIncome - fromOpToTax - toNet;
      link("operating", "net", toNet);
      if (otherOut > 0) {
        node({ id: "other", label: "Other", value: otherOut, flow: otherOut, kind: "cost", column: netCol });
        link("operating", "other", otherOut);
      }
    }
  } else {
    node({
      id: "net",
      label: netIncome > 0 ? "Net profit" : "Net loss",
      value: netIncome,
      flow: 0,
      kind: netIncome > 0 ? "profit" : "loss",
      column: netCol,
    });
  }

  return {
    nodes,
    links,
    revenue,
    grossProfit: hasGross ? reportedGross : null,
    operatingIncome,
    netIncome,
    hasSegments: Boolean(segs),
  };
}

const DERIVED = new Set(["opex", "opex_other", "other", "other_income"]);

function margin(value: number | null, revenue: number): number | null {
  return value === null ? null : value / revenue;
}

function pp(current: number | null, prior: number | null): number | null {
  return current === null || prior === null ? null : (current - prior) * 100;
}

export function buildIncomeFlow(
  current: StoredStatement,
  prior: StoredStatement | null,
): IncomeFlow | null {
  const cur = build(current);
  if (!cur) return null;
  const old = prior ? build(prior) : null;
  const priorValue = new Map(old?.nodes.map((n) => [n.id, n.value]) ?? []);
  // Derived lines are differences of subtotals. When last year had no gross
  // profit split (a gross loss, say) and this year does, "operating expenses"
  // was measured from a different base and a Y/Y on it is meaningless.
  const sameBasis = old !== null && (old.grossProfit === null) === (cur.grossProfit === null);

  for (const n of cur.nodes) {
    const comparable = sameBasis || !DERIVED.has(n.id);
    if (n.kind !== "loss" && comparable) n.yoy = growth(n.value, priorValue.get(n.id));
    if (n.kind === "profit" && n.id !== "other_income") {
      n.margin = n.value / cur.revenue;
    }
  }

  const gm = margin(cur.grossProfit, cur.revenue);
  const om = cur.operatingIncome / cur.revenue;
  const nm = cur.netIncome / cur.revenue;
  const columns = Math.max(...cur.nodes.map((n) => n.column)) + 1;

  return {
    nodes: cur.nodes,
    links: cur.links,
    columns,
    revenue: cur.revenue,
    currency: String(current.data.reportedCurrency ?? "USD"),
    hasSegments: cur.hasSegments,
    metrics: {
      revenueYoy: growth(cur.revenue, old?.revenue),
      grossMargin: gm,
      grossMarginPriorPp: pp(gm, old ? margin(old.grossProfit, old.revenue) : null),
      operatingMargin: om,
      operatingMarginPriorPp: pp(om, old ? old.operatingIncome / old.revenue : null),
      netMargin: nm,
      netMarginPriorPp: pp(nm, old ? old.netIncome / old.revenue : null),
      netIncome: cur.netIncome,
      netIncomeYoy: cur.netIncome > 0 ? growth(cur.netIncome, old?.netIncome) : null,
    },
  };
}
