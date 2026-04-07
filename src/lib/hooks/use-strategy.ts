import { useQuery } from "@tanstack/react-query";

export interface StrategyBacktest {
  benchmark_return_pct: number;
  cagr_pct: number;
  label: string;
  losers: number;
  max_drawdown_pct: number;
  period: string;
  run_id: number;
  sharpe_ratio: number;
  total_return_pct: number;
  total_trades: number;
  win_rate_pct: number;
  winners: number;
}

export interface StrategyHolding {
  ticker: string;
  source: "live" | "backtest";
  entry_date: string;
  entry_price: number;
  current_price: number;
  pnl_pct: number | null;
  backtest_entry_date: string;
  backtest_pnl_pct: number;
  market_value: number;
}

export interface StrategyData {
  backtest: StrategyBacktest;
  holdings: StrategyHolding[];
  live: {
    position_count: number;
    tickers: string[];
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
