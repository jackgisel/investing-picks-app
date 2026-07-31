import { useQuery } from "@tanstack/react-query";
import type { InsightMeta } from "@/lib/insights";
import { dataQueryOptions, fetchJson } from "./api-error";

export interface InsightsResponse {
  insights: InsightMeta[];
}

/**
 * Published research-note metadata.
 *
 * Every client component that links to a note reads this. It replaces a
 * generated module that was compiled into the bundle, so callers must handle
 * the loading state — an insight link is absent for a moment on first paint
 * where it used to be there synchronously.
 */
export function useInsights() {
  return useQuery<InsightsResponse>({
    queryKey: ["insights"],
    queryFn: () => fetchJson<InsightsResponse>("/api/data/insights"),
    ...dataQueryOptions,
  });
}
