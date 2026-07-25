import { useQuery } from "@tanstack/react-query";

export interface Holding {
  ticker: string;
  entry_date: string | null;
  /** Gain vs. cost basis. Real for house-money holdings now, not a flat 0%. */
  pnl_pct: number;
  weight_pct?: number;
  /** Original stake already recovered via a Winners Circle partial sell. */
  is_house_money?: boolean;
  sector?: string | null;
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
}

export function useStrategy() {
  return useQuery<StrategyData>({
    queryKey: ["strategy"],
    queryFn: async () => {
      const res = await fetch("/api/data/strategy");
      if (!res.ok) throw new Error("Failed to fetch strategy");
      return res.json();
    },
  });
}
