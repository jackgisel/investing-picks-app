import { useQuery } from "@tanstack/react-query";
import { dataQueryOptions, fetchJson } from "./api-error";

export type PeriodId = "day" | "week" | "month";

/** One position's return over one period. */
export interface PositionPeriod {
  /** Null when the price history cannot support the window. Never 0 for it. */
  return_pct: number | null;
  /** The session this was measured FROM — the entry date when `partial`. */
  from_date: string | null;
  /**
   * The position was opened inside the window, so this is "since we bought it",
   * not "this week". Surfaces must label the two differently.
   */
  partial: boolean;
}

export interface PeriodPositionRow {
  ticker: string;
  entry_date: string | null;
  /** Resolved from the `stocks` table, not the position row. */
  sector: string | null;
  periods: Record<PeriodId, PositionPeriod>;
}

export interface PeriodSummary {
  id: PeriodId;
  label: string;
  /** Last session before the period opened: Friday's close for a week. */
  from_date: string | null;
  /** Whole-book equity, cash drag included. */
  book_return_pct: number | null;
  spy_return_pct: number | null;
  /** What the currently-held names did, value weighted. */
  open_picks_return_pct: number | null;
  open_picks_positions: number;
  /** Positions left out because they were bought inside the window. */
  open_picks_excluded_new: number;
}

export interface PeriodReturnsResponse {
  as_of: string | null;
  periods: PeriodSummary[];
  positions: PeriodPositionRow[];
}

export function usePeriodReturns() {
  return useQuery<PeriodReturnsResponse>({
    queryKey: ["period-returns"],
    queryFn: () => fetchJson<PeriodReturnsResponse>("/api/data/period-returns"),
    ...dataQueryOptions,
  });
}
