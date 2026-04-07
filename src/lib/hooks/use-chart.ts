import { useQuery } from "@tanstack/react-query";

export interface ChartPoint {
  date: string;
  portfolio_value: number;
  benchmark_value: number;
  source: string;
}

export interface ChartData {
  series: ChartPoint[];
  data_points: number;
  run_id: number;
  backtest_end: string;
}

export function useChart() {
  return useQuery<ChartData>({
    queryKey: ["chart"],
    queryFn: async () => {
      const res = await fetch("/api/data/chart");
      if (!res.ok) throw new Error("Failed to fetch chart");
      return res.json();
    },
  });
}
