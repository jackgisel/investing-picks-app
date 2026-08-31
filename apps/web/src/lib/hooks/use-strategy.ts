import { useQuery } from "@tanstack/react-query";
import { dataQueryOptions, fetchJson } from "./api-error";

export interface Holding {
  /**
   * Null on the anonymised payload served to non-subscribers — `/api/data/
   * strategy` answers 200, not 402, so this shape reaches the browser on the
   * normal success path. Declaring it non-optional is what let a ticker-less
   * row crash the positions page.
   */
  ticker: string | null;
  entry_date: string | null;
  /**
   * Gain vs. cost basis. Real for house-money holdings now, not a flat 0%.
   *
   * Nullable: the API used to publish `_pnl_pct(...) or 0`, so an unrecoverable
   * cost basis reached the UI as a confident 0.00%. It now sends null for
   * "unknown" and reserves 0 for a genuinely flat position. Anything reading
   * this must distinguish the two — `formatPctOrDash` and `pnlClass` already
   * do, and `comparePnl` keeps unknowns out of the top/bottom performer lists.
   */
  pnl_pct: number | null;
  weight_pct?: number;
  /**
   * Company market cap in USD, from the `stocks` reference table. Absent on
   * the anonymised payload, and null for a name whose profile has never been
   * ingested — so the size column has to render "—" rather than assume.
   */
  market_cap?: number | null;
  /** Original stake already recovered via a Winners Circle partial sell. */
  is_house_money?: boolean;
  sector?: string | null;
  fundamentals?: {
    as_of: string;
    growth_basis_period: string | null;
    estimate_period: string | null;
    revenue_growth_ttm_pct: number | null;
    eps_growth_ttm_pct: number | null;
    revenue_estimate: number | null;
    eps_estimate: number | null;
    revenue_revision_pct: number | null;
    eps_revision_pct: number | null;
    earnings_report_date: string | null;
    revenue_actual: number | null;
    revenue_report_estimate: number | null;
    revenue_surprise_pct: number | null;
    eps_actual: number | null;
    eps_report_estimate: number | null;
    eps_surprise_pct: number | null;
    mark: number | null;
    price_target_low: number | null;
    price_target_mean: number | null;
    price_target_high: number | null;
    price_target_analyst_count: number | null;
  } | null;
}

export interface StrategyData {
  holdings: Holding[];
  portfolio: {
    position_count: number;
    tickers: string[];
    /**
     * Cumulative return on capital deployed into picks — the headline for a
     * research product. Excludes idle cash, includes closed picks.
     */
    picks_return_pct?: number | null;
    picks?: {
      return_pct: number | null;
      deployed: number;
      open_value: number;
      realized: number;
      open_count: number;
      closed_count: number;
    };
    /** Whole-book equity return including cash drag. */
    total_return_pct: number | null;
  };
  strategy: {
    name: string;
    description: string;
    evaluation_frequency: string;
    max_positions: number;
  };
  // Extended
  name?: string;
  evaluation_frequency?: string;
  max_positions?: number;
  position_count?: number;
  params_version?: string;
  params?: Record<string, unknown>;
  /**
   * The next date the book is re-evaluated (ISO calendar date). Published
   * because the cadence is otherwise invisible — a subscriber looking at an
   * unchanged holdings table cannot tell a strategy that chose to do nothing
   * from one that is simply between cycles.
   */
  next_evaluation_date?: string | null;
}

export function useStrategy(initialData?: StrategyData) {
  return useQuery<StrategyData>({
    queryKey: ["strategy"],
    queryFn: () => fetchJson<StrategyData>("/api/data/strategy"),
    // initialData is SSR'd anonymised public numbers so the first HTML paint
    // is not an em dash. Leave it stale (no initialDataUpdatedAt) so a
    // subscriber who then opens the dashboard still refetches the entitled
    // payload instead of sitting on the public snapshot for staleTime.
    ...(initialData ? { initialData } : {}),
    ...dataQueryOptions,
  });
}
