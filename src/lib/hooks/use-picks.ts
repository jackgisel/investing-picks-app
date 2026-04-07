import { useQuery } from "@tanstack/react-query";

export interface Pick {
  ticker: string;
  status: string;
  source: string;
  source_id: number;
  entry_date: string;
  entry_price: number;
  current_price: number;
  pnl_pct: number;
  dollar_pnl: number;
  from_peak_pct: number | null;
  hold_months: number | null;
  market_value: number;
  peak_price: number | null;
  shares: number;
  exit_date: string | null;
  exit_price: number | null;
  exit_reason: string | null;
}

export interface PicksResponse {
  picks: Pick[];
  count: number;
  status: string;
  source: string;
}

export function usePicks(status: "active" | "closed" = "active") {
  return useQuery<PicksResponse>({
    queryKey: ["picks", status],
    queryFn: async () => {
      const res = await fetch(`/api/data/picks?status=${status}`);
      if (!res.ok) throw new Error("Failed to fetch picks");
      return res.json();
    },
  });
}
