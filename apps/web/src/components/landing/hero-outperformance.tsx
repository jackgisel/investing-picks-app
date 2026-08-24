"use client";

import { useMemo } from "react";
import { buildPicksComparison, useChart } from "@/lib/hooks/use-chart";
import { formatPct } from "@/lib/portfolio";

/**
 * Live picks return since inception, with the same-money S&P beside it.
 *
 * Both numbers come from the performance comparison (capital deployed into
 * picks vs that money in SPY), so they are directly comparable — not the
 * cash-dragged book equity line.
 */
export function HeroOutperformance({ className = "" }: { className?: string }) {
  const { data, isPending } = useChart();
  const comparison = useMemo(() => buildPicksComparison(data), [data]);

  const picksPct = comparison.picksLatestPct;
  const spyPct =
    comparison.benchmarks.find((b) => b.key === "SPY")?.latestPct ?? null;

  // Skeleton heights track the resolved markup below exactly (28/32px
  // leading-none headline, 13/14px sub). This sits in the hero's LCP region,
  // so a mismatch here is a visible jump on every cold load.
  if (isPending && picksPct === null) {
    return (
      <div className={className} aria-hidden>
        <div className="h-[28px] w-44 animate-pulse rounded-soft bg-bg-secondary/80 sm:h-[32px]" />
        <div className="mt-2 h-[19px] w-28 animate-pulse rounded-soft bg-bg-secondary/60 sm:h-[20px]" />
      </div>
    );
  }

  if (picksPct === null) {
    return null;
  }

  const up = picksPct >= 0;

  return (
    <div className={className}>
      <p
        className={`font-sans text-[28px] sm:text-[32px] font-extrabold leading-none tracking-tight tabular-nums ${
          up ? "text-accent-green" : "text-accent-red"
        }`}
      >
        {formatPct(picksPct, 1)}
        <span className="ml-2 text-[14px] sm:text-[15px] font-semibold tracking-normal text-text-muted">
          since inception
        </span>
      </p>
      {spyPct !== null ? (
        <p className="mt-2 font-sans text-[13px] sm:text-[14px] text-text-dim tabular-nums">
          S&amp;P 500{" "}
          <span className="font-semibold text-text-muted">
            {formatPct(spyPct, 1)}
          </span>
        </p>
      ) : null}
    </div>
  );
}
