import { useQuery } from "@tanstack/react-query";

export interface Trade {
  ticker: string;
  side: "buy" | "sell";
  date: string;
  price: number;
  shares: number;
  reason: string | null;
}

export interface TradesResponse {
  trades: Trade[];
  count: number;
  thesis_id: number;
}

export function useTrades(limit?: number) {
  return useQuery<TradesResponse>({
    queryKey: ["trades", limit],
    queryFn: async () => {
      const url = limit
        ? `/api/data/trades?limit=${limit}`
        : "/api/data/trades";
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to fetch trades");
      return res.json();
    },
  });
}
