import { useQuery } from "@tanstack/react-query";
import { dataQueryOptions, fetchJson } from "./api-error";

export interface Trade {
  ticker: string;
  side: "buy" | "sell";
  date: string;
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
    queryFn: () =>
      fetchJson<TradesResponse>(
        limit ? `/api/data/trades?limit=${limit}` : "/api/data/trades"
      ),
    ...dataQueryOptions,
  });
}
