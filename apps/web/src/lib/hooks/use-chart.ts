import { useQuery } from "@tanstack/react-query";
import { dataQueryOptions, fetchJson } from "./api-error";

export interface ChartPoint {
  date: string;
  /**
   * Whole-book equity return, cash included. Kept for backwards compatibility
   * only — this is the number that made the old chart self-defeating, because a
   * book that is 90%+ cash cannot out-run a fully invested index no matter how
   * good the picks are. Nothing should plot this any more.
   */
  portfolio_pct: number | null;
  /** Buy-and-hold SPY from inception. Same caveat as `portfolio_pct`. */
  benchmark_pct: number | null;
  /** Newer alias the API emits alongside `portfolio_pct`. */
  return_pct?: number | null;
  /** Newer alias the API emits alongside `benchmark_pct`. */
  spy_return_pct?: number | null;
}

/**
 * One point on a cumulative-return curve.
 *
 * `return_pct` is a percentage (31.3 means +31.30%), always measured from the
 * first entry date, so every series in a `PerformanceData` response is 0.0 on
 * its first point and the lines are directly comparable.
 */
export interface ReturnPoint {
  date: string;
  return_pct: number;
}

/**
 * Benchmarks priced off the picks' OWN cash flows.
 *
 * Not an index-since-inception line. For each benchmark the backend spends the
 * same dollars on the same dates the picks were bought, so the comparison
 * answers "what if that money had gone into the index instead" rather than the
 * flattering-to-neither question of how a mostly-cash book compares with a
 * fully invested index.
 */
export interface BenchmarkData {
  /** Ticker → display name, e.g. `{ SPY: "S&P 500" }`. */
  labels: Record<string, string>;
  /**
   * Ticker → curve. A ticker is OMITTED entirely when its price history is
   * unavailable — the backend deliberately drops it rather than drawing a flat
   * line, so consumers must cope with 0, 1, 2 or 3 entries here.
   */
  series: Record<string, ReturnPoint[]>;
  /** Capital deployed into picks, in dollars. The UI does not render dollars. */
  deployed?: number | null;
}

export interface ChartData {
  /** Legacy book-equity series. See `ChartPoint` — do not plot. */
  series: ChartPoint[];
  /**
   * Return on capital actually deployed into picks — the headline curve, and
   * the only one that describes the product. May be absent or empty on an API
   * that predates it, or before the first pick is entered.
   */
  picks_series?: ReturnPoint[];
  benchmarks?: BenchmarkData;
  summary: {
    position_count: number;
    total_return_pct: number | null;
    snapshot_return_pct?: number | null;
    start_date?: string;
    latest_date?: string;
    inception_date?: string;
    snapshots?: number;
    /** Annualized picks return. Only meaningful when `annualized_status` is "ok". */
    annualized_return_pct?: number | null;
    annualized_status?: string | null;
    days_live?: number | null;
    days_recorded?: number | null;
    min_window_days?: number | null;
  };
  thesis_id?: number;
}

/**
 * A benchmark reduced to what the chart needs: how to draw it and where it
 * ended up.
 */
export interface BenchmarkMeta {
  /** Ticker, e.g. "SPY". Doubles as the row key on `ComparisonRow`. */
  key: string;
  /** Human label, e.g. "S&P 500". Falls back to the ticker. */
  label: string;
  /** Final cumulative return, or null for a series with no points. */
  latestPct: number | null;
}

/**
 * One x-position on the comparison chart: a date, the picks value, and one
 * entry per benchmark keyed by ticker.
 *
 * A null means that series has no observation on that date — benchmarks lag the
 * picks curve by a day whenever a mark has not landed yet — and the chart
 * bridges those rather than fragmenting the line.
 */
export interface ComparisonRow {
  date: string;
  picks: number | null;
  [ticker: string]: string | number | null;
}

export interface PicksComparison {
  rows: ComparisonRow[];
  benchmarks: BenchmarkMeta[];
  /** Final picks return, or null when there is no picks curve. */
  picksLatestPct: number | null;
  /** First date on the merged axis — the date every line is 0% on. */
  startDate: string | null;
  latestDate: string | null;
}

/**
 * Preferred left-to-right ordering in legends and tooltips. Anything the API
 * adds later sorts alphabetically after these.
 */
const BENCHMARK_ORDER = ["SPY", "VTI", "MAGS"];

function orderBenchmarks(keys: string[]): string[] {
  return [...keys].sort((a, b) => {
    const ia = BENCHMARK_ORDER.indexOf(a);
    const ib = BENCHMARK_ORDER.indexOf(b);
    if (ia !== -1 && ib !== -1) return ia - ib;
    if (ia !== -1) return -1;
    if (ib !== -1) return 1;
    return a.localeCompare(b);
  });
}

function lastValue(points: ReturnPoint[] | undefined): number | null {
  if (!points?.length) return null;
  const value = points[points.length - 1]?.return_pct;
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/**
 * Merge the picks curve and every present benchmark onto one date axis.
 *
 * Aligned BY DATE, never by array index. The series genuinely differ in length
 * — SPY and picks currently have 74 points while VTI and MAGS have 73, because
 * their latest mark has not landed — so zipping by position would shift every
 * benchmark point by a day and silently misstate the comparison.
 */
export function buildPicksComparison(chart: ChartData | undefined): PicksComparison {
  const picks = chart?.picks_series ?? [];
  const rawSeries = chart?.benchmarks?.series ?? {};
  const labels = chart?.benchmarks?.labels ?? {};

  // Drop tickers that came through with no usable points; an entry present but
  // empty is the same thing as omitted as far as the chart is concerned.
  const keys = orderBenchmarks(
    Object.keys(rawSeries).filter((k) => (rawSeries[k]?.length ?? 0) > 0)
  );

  const byDate = new Map<string, Map<string, number>>();
  const addPoint = (key: string, point: ReturnPoint) => {
    if (!point?.date || typeof point.return_pct !== "number") return;
    if (!Number.isFinite(point.return_pct)) return;
    let row = byDate.get(point.date);
    if (!row) {
      row = new Map<string, number>();
      byDate.set(point.date, row);
    }
    row.set(key, point.return_pct);
  };

  picks.forEach((p) => addPoint("picks", p));
  keys.forEach((key) => (rawSeries[key] ?? []).forEach((p) => addPoint(key, p)));

  // ISO dates sort correctly as plain strings.
  const dates = [...byDate.keys()].sort();

  const rows: ComparisonRow[] = dates.map((date) => {
    const values = byDate.get(date)!;
    const row: ComparisonRow = {
      date,
      picks: values.has("picks") ? values.get("picks")! : null,
    };
    keys.forEach((key) => {
      row[key] = values.has(key) ? values.get(key)! : null;
    });
    return row;
  });

  return {
    rows,
    benchmarks: keys.map((key) => ({
      key,
      label: labels[key] ?? key,
      latestPct: lastValue(rawSeries[key]),
    })),
    picksLatestPct: lastValue(picks),
    startDate: dates[0] ?? null,
    latestDate: dates[dates.length - 1] ?? null,
  };
}

// Uses /performance, which carries the legacy book-equity series plus the
// picks curve and its cash-flow-matched benchmarks.
export function useChart() {
  return useQuery<ChartData>({
    queryKey: ["chart"],
    queryFn: () => fetchJson<ChartData>("/api/data/performance"),
    ...dataQueryOptions,
  });
}
