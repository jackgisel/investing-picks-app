import { useQuery } from "@tanstack/react-query";
import { dataQueryOptions, fetchJson } from "./api-error";

export interface Pick {
  ticker: string;
  status: string;
  entry_date: string;
  pnl_pct: number | null;
  exit_date: string | null;
  exit_reason: string | null;
  /** Slug of the linked /insights blog post, if one exists. */
  blog_slug?: string | null;
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
    queryFn: () => fetchJson<PicksResponse>(`/api/data/picks?status=${status}`),
    ...dataQueryOptions,
  });
}
