import { useQuery } from "@tanstack/react-query";
import { dataQueryOptions, fetchJson } from "./api-error";

export interface DcaBookSummary {
  value: number;
  cash: number;
  invested: number;
  position_count: number;
  return_on_contributed_pct: number | null;
}

export interface DcaPoint {
  date: string;
  contributed: number;
  voo: number | null;
  picks: number | null;
}

export interface DcaPerformance {
  inception_date: string;
  weekly_amount: number;
  contributed: number;
  weeks: number;
  voo: DcaBookSummary | null;
  picks: DcaBookSummary | null;
  delta: { dollars: number; pct_of_contributed: number | null } | null;
  series: DcaPoint[];
}

export interface DcaHolding {
  ticker: string;
  sector: string | null;
  entry_date: string | null;
  weight_pct: number;
  pnl_pct: number | null;
  quant_rating: number | null;
  signal: string | null;
}

export interface DcaHoldings {
  rating_as_of: string | null;
  voo: DcaHolding[];
  picks: DcaHolding[];
}

export function useDcaPerformance() {
  return useQuery<DcaPerformance>({
    queryKey: ["dca", "performance"],
    queryFn: () => fetchJson<DcaPerformance>("/api/data/dca/performance"),
    ...dataQueryOptions,
  });
}

export function useDcaHoldings() {
  return useQuery<DcaHoldings>({
    queryKey: ["dca", "holdings"],
    queryFn: () => fetchJson<DcaHoldings>("/api/data/dca/holdings"),
    ...dataQueryOptions,
  });
}
