"use client";

import { useQuery } from "@tanstack/react-query";
import { LIVE_PORTFOLIO } from "@/lib/constants";

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
    queryFn: async () => {
      const res = await fetch("/api/portfolio-meta");
      if (!res.ok) throw new Error("Failed to load portfolio meta");
      return (await res.json()) as PortfolioMeta;
    },
  });

  return {
    inceptionISO: data?.inception_date || LIVE_PORTFOLIO.inceptionISO,
    isLoading,
    source: data?.source ?? "fallback",
  };
}
