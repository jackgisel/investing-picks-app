import { useQuery } from "@tanstack/react-query";

export interface ChartPoint {
  date: string;
  // Cumulative % return from inception. Both lines are 0% on day 1.
  portfolio_pct: number | null;
  benchmark_pct: number | null;
}

export interface ChartData {
  series: ChartPoint[];
  summary: {
    position_count: number;
    total_return_pct: number | null;
    snapshot_return_pct?: number | null;
    start_date?: string;
    latest_date?: string;
    snapshots?: number;
  };
  thesis_id: number;
}

// Uses /performance which now returns a percentage-only series.
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
