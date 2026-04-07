import { useQuery } from "@tanstack/react-query";

export interface Holding {
  ticker: string;
  entry_date: string;
  entry_price: number;
  current_price: number;
  pnl_pct: number;
  market_value: number;
  shares: number;
}

export interface StrategyData {
  holdings: Holding[];
  portfolio: {
    position_count: number;
    tickers: string[];
    total_unrealized_pnl: number;
    total_value: number;
  };
  strategy: {
    name: string;
    description: string;
    evaluation_frequency: string;
    max_positions: number;
  };
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
