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
};

export type WorkforceBoard = {
  order: WorkforceOrder;
  universe: number;
  median_rev_per_employee: number | null;
  sectors: string[];
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

export type WorkforceHistory = {
  ticker: string;
  name: string | null;
  sector: string | null;
  industry: string | null;
  series: WorkforcePoint[];
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
}): Promise<WorkforceBoard | null> {
  const params = new URLSearchParams({
    order: opts.order,
    limit: String(opts.limit),
  });
  if (opts.sector) params.set("sector", opts.sector);
  try {
    const res = await fetch(`${PUBLIC_API_BASE}/workforce/leaderboard?${params}`, {
      next: { revalidate: 300 },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as WorkforceBoard;
    return Array.isArray(data?.rows) ? data : null;
  } catch {
    return null;
  }
}

/** `$2.4M` / `$850K` per employee. */
export function formatPerEmployee(value: number | null | undefined): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return "—";
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(value >= 10_000_000 ? 1 : 2)}M`;
  return `$${Math.round(value / 1000).toLocaleString("en-US")}K`;
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

/** `FY2025` from a fiscal period end date. */
export function fiscalYearLabel(period: string): string {
  return `FY${period.slice(0, 4)}`;
}

/** Index a series to 100 at its first value, so two different units share an axis. */
export function indexTo100(values: number[]): number[] {
  const base = values[0];
  if (!base) return values.map(() => NaN);
  return values.map((v) => (v / base) * 100);
}
