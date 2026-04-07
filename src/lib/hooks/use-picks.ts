import { useQuery } from "@tanstack/react-query";

export interface Pick {
  ticker: string;
  status: string;
  entry_date: string;
  entry_price: number;
  current_price: number;
  pnl_pct: number;
  dollar_pnl: number;
  market_value: number;
  shares: number;
  exit_date: string | null;
  exit_price: number | null;
  exit_reason: string | null;
}

export interface PicksResponse {
  picks: Pick[];
  count: number;
  status: string;
  thesis_id: number;
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
