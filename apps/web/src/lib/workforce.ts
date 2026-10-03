import { PUBLIC_API_BASE } from "@/lib/api-config";

export type WorkforceOrder = "rev_per_employee" | "leverage" | "revenue";

export const WORKFORCE_ORDERS: ReadonlyArray<{
  id: WorkforceOrder;
  label: string;
}> = [
  { id: "rev_per_employee", label: "Revenue per employee" },
  { id: "leverage", label: "Operating leverage" },
  { id: "revenue", label: "Revenue" },
];

/** Rows a visitor sees without a membership. The full board is the paid view. */
export const FREE_ROWS = 10;
export const MEMBER_ROWS = 100;
/** The screen, passed to the API explicitly so the page copy cannot drift from it. */
export const MIN_REVENUE = 500_000_000;
export const MIN_EMPLOYEES = 50;

export type WorkforceShape =
  | "leaner"
  | "efficient_growth"
  | "hiring_ahead"
  | "contracting"
  | "hiring_into_decline";

export const WORKFORCE_SHAPES: ReadonlyArray<{
  id: WorkforceShape;
  label: string;
  blurb: string;
}> = [
  { id: "leaner", label: "Leaner", blurb: "Revenue up or flat, headcount down or flat" },
  { id: "efficient_growth", label: "Efficient growth", blurb: "Both up, revenue faster" },
  { id: "hiring_ahead", label: "Hiring ahead", blurb: "Both up, headcount faster" },
  { id: "contracting", label: "Contracting", blurb: "Revenue down, headcount down or flat" },
  { id: "hiring_into_decline", label: "Hiring into decline", blurb: "Revenue down, headcount up" },
];

export function isWorkforceShape(value: unknown): value is WorkforceShape {
  return WORKFORCE_SHAPES.some((s) => s.id === value);
}

export function shapeLabel(shape: WorkforceShape | null | undefined): string {
  return WORKFORCE_SHAPES.find((s) => s.id === shape)?.label ?? "—";
}

export type GrowthPoint = {
  ticker: string;
  name: string | null;
  sector: string | null;
  employees_yoy: number;
  revenue_yoy: number;
  rev_per_employee: number;
  shape: WorkforceShape;
};

export type GrowthPayload = {
  shape_counts: Record<WorkforceShape, number>;
  points: GrowthPoint[];
};

export type WorkforceRow = {
  rank: number;
  ticker: string;
  name: string | null;
  sector: string | null;
  industry: string | null;
  market_cap: number | null;
  period: string;
  filing_date: string;
  employees: number;
  revenue: number;
  rev_per_employee: number;
  employees_yoy: number | null;
  revenue_yoy: number | null;
  leverage: number | null;
  industry_pct: number | null;
  shape: WorkforceShape | null;
  /** Open roles on the company's public job board; null where we have no verified board. */
  openings: number | null;
  openings_as_of: string | null;
  openings_per_1000: number | null;
  openings_change_90d: number | null;
};

export type WorkforceBoard = {
  order: WorkforceOrder;
  universe: number;
  median_rev_per_employee: number | null;
  sectors: string[];
  excluded_sectors: string[];
  shape_counts: Record<WorkforceShape, number>;
  count: number;
  rows: WorkforceRow[];
};

export type WorkforcePoint = {
  period: string;
  filing_date: string;
  employees: number;
  revenue: number;
  rev_per_employee: number | null;
  employees_yoy: number | null;
  revenue_yoy: number | null;
};

export type OpeningsPoint = { as_of: string; open_count: number };

export type WorkforceHistory = {
  ticker: string;
  name: string | null;
  sector: string | null;
  industry: string | null;
  series: WorkforcePoint[];
  openings: OpeningsPoint[];
  openings_as_of: string | null;
  openings_per_1000: number | null;
  openings_change_90d: number | null;
};

export function isWorkforceOrder(value: unknown): value is WorkforceOrder {
  return WORKFORCE_ORDERS.some((o) => o.id === value);
}

/**
 * The board, or null when upstream is down or has no headcount data yet.
 * Callers render an honest empty state, never invented rows.
 */
export async function getWorkforceBoard(opts: {
  order: WorkforceOrder;
  limit: number;
  sector?: string | null;
  shape?: WorkforceShape | null;
}): Promise<WorkforceBoard | null> {
  const params = new URLSearchParams({
    order: opts.order,
    limit: String(opts.limit),
    min_revenue: String(MIN_REVENUE),
    min_employees: String(MIN_EMPLOYEES),
  });
  if (opts.sector) params.set("sector", opts.sector);
  if (opts.shape) params.set("shape", opts.shape);
  try {
    const res = await fetch(`${PUBLIC_API_BASE}/workforce/leaderboard?${params}`, {
      next: { revalidate: 300 },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as WorkforceBoard;
    if (!Array.isArray(data?.rows)) return null;
    // A response cached before a deploy may predate a field; never let that
    // reach the page as undefined.
    return {
      ...data,
      shape_counts: data.shape_counts ?? ({} as WorkforceBoard["shape_counts"]),
      excluded_sectors: data.excluded_sectors ?? [],
    };
  } catch {
    return null;
  }
}

/** `$2.4M` / `$850K` per employee. */
export function formatPerEmployee(value: number | null | undefined): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return "—";
  // Pick the unit from the rounded thousands, so 999,600 reads $1.00M and not
  // "$1,000K".
  const thousands = Math.round(value / 1000);
  if (thousands >= 1000) {
    return `$${(value / 1_000_000).toFixed(value >= 10_000_000 ? 1 : 2)}M`;
  }
  if (thousands < 1) return `$${Math.round(value).toLocaleString("en-US")}`;
  return `$${thousands.toLocaleString("en-US")}K`;
}

/** `12,400` below 100K, `1.4M` above. */
export function formatEmployees(value: number | null | undefined): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return "—";
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`;
  return Math.round(value).toLocaleString("en-US");
}

/** A growth fraction as a signed percent: `+12.3%`, `-4.0%`, or a dash. */
export function formatGrowth(value: number | null | undefined): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return "—";
  const pct = value * 100;
  return `${pct >= 0 ? "+" : ""}${pct.toFixed(1)}%`;
}

/** Leverage is a difference of two growth rates, so it reads in points. */
export function formatLeverage(value: number | null | undefined): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return "—";
  const pts = value * 100;
  return `${pts >= 0 ? "+" : ""}${pts.toFixed(1)} pts`;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/**
 * `Sep 2025`: the month the fiscal year ended. Companies disagree on what to
 * call a year that ends in January or February, so the end date is the one
 * label that matches nobody's convention wrongly.
 */
export function fiscalYearLabel(period: string): string {
  const month = Number(period.slice(5, 7));
  const name = MONTHS[month - 1];
  return name ? `${name} ${period.slice(0, 4)}` : period.slice(0, 4);
}

/** `'25`, for a tight axis. */
export function fiscalYearShort(period: string): string {
  return `'${period.slice(2, 4)}`;
}

/** Index a series to 100 at its first value, so two different units share an axis. */
export function indexTo100(values: number[]): number[] {
  const base = values[0];
  if (!base) return values.map(() => NaN);
  return values.map((v) => (v / base) * 100);
}

/**
 * Where to draw a growth scatter. Axes run from the 2nd to the 98th
 * percentile (always including zero) so a handful of extreme companies do not
 * flatten everyone else; points beyond an edge are pinned to it.
 */
export function growthDomain(values: number[]): [number, number] {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (sorted.length === 0) return [-0.2, 0.2];
  const at = (q: number) => sorted[Math.min(sorted.length - 1, Math.max(0, Math.round(q * (sorted.length - 1))))];
  const lo = Math.min(at(0.02), 0);
  const hi = Math.max(at(0.98), 0);
  const pad = (hi - lo) * 0.06 || 0.05;
  return [lo - pad, hi + pad];
}

/** `212`, or a dash where we have no verified job board. */
export function formatOpenings(value: number | null | undefined): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return "—";
  return Math.round(value).toLocaleString("en-US");
}

/** `14 per 1,000 staff`, one decimal under ten. */
export function formatOpeningsRate(value: number | null | undefined): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return "—";
  return `${value < 10 ? value.toFixed(1) : Math.round(value)} per 1,000 staff`;
}
