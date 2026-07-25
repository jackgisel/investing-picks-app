"use client";

import { useQuery } from "@tanstack/react-query";
import { LIVE_PORTFOLIO } from "@/lib/constants";
import { dataQueryOptions, fetchJson } from "./api-error";

export type PortfolioMeta = {
  inception_date: string;
  source: "db" | "fallback";
};

/**
 * Live portfolio inception date, read from the database via /api/portfolio-meta.
 *
 * `LIVE_PORTFOLIO.inceptionISO` is only a fallback for the first render and for
 * when the API is unreachable — the database is the source of truth and the
 * date is editable at /dashboard/ops/positions.
 */
export function useInceptionDate(): {
  inceptionISO: string;
  isLoading: boolean;
  source: PortfolioMeta["source"];
} {
  const { data, isLoading } = useQuery({
    queryKey: ["portfolio-meta"],
    staleTime: 5 * 60 * 1000,
    queryFn: () => fetchJson<PortfolioMeta>("/api/portfolio-meta"),
    // This hook has a real fallback (the constant), so a failure is not
    // user-visible — but it must still fail fast rather than retrying a 4xx,
    // otherwise `isLoading` sticks and callers render a placeholder for
    // seconds longer than necessary.
    ...dataQueryOptions,
  });

  return {
    inceptionISO: data?.inception_date || LIVE_PORTFOLIO.inceptionISO,
    isLoading,
    source: data?.source ?? "fallback",
  };
}
