import { useQuery } from "@tanstack/react-query";
import { dataQueryOptions, fetchJson } from "./api-error";

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
    queryFn: () => fetchJson<ChartData>("/api/data/performance"),
    ...dataQueryOptions,
  });
}
