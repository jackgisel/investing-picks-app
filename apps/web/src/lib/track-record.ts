import type { MonthReturn, ScorecardPick } from "@/lib/hooks/use-track-record";

/**
 * Roll-ups for the Performance page's track record — the factsheet numbers a
 * published stock-picking record is judged on: how many picks beat the index
 * over their own holding period, what the typical pick did, and how steady the
 * months were. Pure, so the counting rules are testable.
 *
 * Unknowns are excluded from both sides of every ratio and never read as 0.
 */

function known(v: number | null | undefined): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export interface Ratio {
  n: number;
  of: number;
  pct: number | null;
}

function ratio(n: number, of: number): Ratio {
  return { n, of, pct: of > 0 ? (n / of) * 100 : null };
}

export interface ScorecardStats {
  total: number;
  open: number;
  closed: number;
  /** Picks ahead of the S&P over their own holding period. */
  beatSpy: Ratio;
  /** Closed picks that finished above cost. */
  closedWins: Ratio;
  medianReturnPct: number | null;
  medianExcessPct: number | null;
  best: ScorecardPick | null;
  worst: ScorecardPick | null;
  /** Picks at +100% or better. */
  doubled: number;
}

export function scorecardStats(picks: readonly ScorecardPick[]): ScorecardStats {
  const scored = picks.filter((p) => known(p.return_pct));
  const withExcess = picks.filter((p) => known(p.excess_pct));
  const closedScored = scored.filter((p) => p.status === "closed");
  const byReturn = [...scored].sort(
    (a, b) => (b.return_pct as number) - (a.return_pct as number),
  );
  return {
    total: picks.length,
    open: picks.filter((p) => p.status === "active").length,
    closed: picks.filter((p) => p.status === "closed").length,
    beatSpy: ratio(
      withExcess.filter((p) => (p.excess_pct as number) > 0).length,
      withExcess.length,
    ),
    closedWins: ratio(
      closedScored.filter((p) => (p.return_pct as number) > 0).length,
      closedScored.length,
    ),
    medianReturnPct: median(scored.map((p) => p.return_pct as number)),
    medianExcessPct: median(withExcess.map((p) => p.excess_pct as number)),
    best: byReturn[0] ?? null,
    worst: byReturn.length > 1 ? byReturn[byReturn.length - 1] : null,
    doubled: scored.filter((p) => (p.return_pct as number) >= 100).length,
  };
}

export interface MonthStats {
  /** Months the picks finished ahead of the S&P. */
  beatSpy: Ratio;
  /** Months the picks finished up. */
  positive: Ratio;
  best: MonthReturn | null;
  worst: MonthReturn | null;
}

export function monthStats(months: readonly MonthReturn[]): MonthStats {
  const picks = months.filter((m) => known(m.picks_pct));
  const both = picks.filter((m) => known(m.spy_pct));
  const byReturn = [...picks].sort(
    (a, b) => (b.picks_pct as number) - (a.picks_pct as number),
  );
  return {
    beatSpy: ratio(
      both.filter((m) => (m.picks_pct as number) > (m.spy_pct as number)).length,
      both.length,
    ),
    positive: ratio(
      picks.filter((m) => (m.picks_pct as number) > 0).length,
      picks.length,
    ),
    best: byReturn[0] ?? null,
    worst: byReturn.length > 1 ? byReturn[byReturn.length - 1] : null,
  };
}

export interface YearRow {
  year: number;
  /** Index 0 = January. Null for a month outside the record. */
  cells: (MonthReturn | null)[];
}

/** Months laid out as a year × Jan–Dec grid, newest year first. */
export function monthGrid(months: readonly MonthReturn[]): YearRow[] {
  const byYear = new Map<number, (MonthReturn | null)[]>();
  for (const m of months) {
    const [y, mo] = m.month.split("-").map(Number);
    if (!y || !mo) continue;
    const cells = byYear.get(y) ?? Array<MonthReturn | null>(12).fill(null);
    cells[mo - 1] = m;
    byYear.set(y, cells);
  }
  return [...byYear.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([year, cells]) => ({ year, cells }));
}

/** `2026-05` → `May 2026`. */
export function formatMonth(month: string): string {
  const [y, mo] = month.split("-").map(Number);
  if (!y || !mo) return month;
  return new Date(Date.UTC(y, mo - 1, 1)).toLocaleDateString("en-US", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** Calendar days between entry and exit (or `asOf` for an open pick). */
export function daysHeld(
  pick: Pick<ScorecardPick, "entry_date" | "exit_date">,
  asOf: string,
): number | null {
  if (!pick.entry_date) return null;
  const a = Date.parse(`${pick.entry_date.slice(0, 10)}T00:00:00Z`);
  const b = Date.parse(`${(pick.exit_date ?? asOf).slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(a) || Number.isNaN(b)) return null;
  return Math.max(0, Math.round((b - a) / 86_400_000));
}
