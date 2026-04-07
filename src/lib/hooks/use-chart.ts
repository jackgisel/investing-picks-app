import { useQuery } from "@tanstack/react-query";

export interface ChartPoint {
  date: string;
  portfolio_value: number;
  benchmark_value?: number;
}

export interface ChartData {
  series: ChartPoint[];
  summary: {
    position_count: number;
    total_unrealized_pnl: number;
    total_value: number;
  };
  thesis_id: number;
}

// Uses /performance which now returns the live series
export function useChart() {
  return useQuery<ChartData>({
    queryKey: ["chart"],
    queryFn: async () => {
      const res = await fetch("/api/data/performance");
      if (!res.ok) throw new Error("Failed to fetch chart");
      return res.json();
    },
  });
}
