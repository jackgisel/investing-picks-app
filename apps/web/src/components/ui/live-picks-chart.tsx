"use client";

import { useMemo } from "react";
import { useChart, buildPicksComparison } from "@/lib/hooks/use-chart";
import { DataState, resolveDataState } from "@/components/ui/data-state";
import {
  BenchmarkBasisNote,
  PicksBenchmarkChart,
  PicksBenchmarkLegend,
  formatChartPct,
} from "@/components/ui/picks-benchmark-chart";

/**
 * The real, live picks-vs-benchmarks curve — used as marketing imagery, not
 * just marketing-page proof.
 *
 * This used to live only inside the track-record section, several scrolls
 * below the hero. The hero's original art was a stock illustration of a
 * person at a desk; this chart is the actual thing a visitor is being asked
 * to trust, so it does more persuading in the same pixels. One headline
 * number, one legend, one line of basis copy — a visitor should get "the
 * picks beat the same money in the index" in about two seconds without
 * reading anything.
 */
export function LivePicksChart({ height = 280 }: { height?: number }) {
  const { data, isPending, isError, error, refetch } = useChart();
  const comparison = useMemo(() => buildPicksComparison(data), [data]);
  const picksPoints = comparison.rows.filter((r) => r.picks !== null).length;

  const shellClass = "rounded-soft border border-border bg-bg overflow-hidden";

  if (isPending) {
    return (
      <div className={`${shellClass} h-[340px] flex items-center justify-center`}>
        <span className="font-sans text-[11px] font-bold tracking-[0.12em] uppercase text-text-dim animate-pulse">
          Loading live chart...
        </span>
      </div>
    );
  }

  if (isError) {
    const state = resolveDataState({
      isPending: false,
      isError: true,
      error,
      isEmpty: false,
    })!;
    return (
      <div className={shellClass}>
        <DataState state={state} error={error} onRetry={() => void refetch()} />
      </div>
    );
  }

  if (picksPoints < 2) {
    return (
      <div className={`${shellClass} px-6 sm:px-7 py-10 text-center`}>
        <p className="font-sans text-[11px] font-bold tracking-[0.12em] uppercase text-text-dim">
          Building track record
        </p>
        <p className="font-sans text-[13px] text-text-muted mt-2">
          The live picks curve appears here once there are two days of marks.
        </p>
      </div>
    );
  }

  const { picksLatestPct, benchmarks, startDate } = comparison;
  const bestBenchmark = benchmarks.reduce<number | null>(
    (acc, b) =>
      b.latestPct === null ? acc : acc === null ? b.latestPct : Math.max(acc, b.latestPct),
    null
  );
  const lead =
    picksLatestPct !== null && bestBenchmark !== null
      ? picksLatestPct - bestBenchmark
      : null;

  return (
    <div className={shellClass}>
      <div className="flex flex-wrap items-center justify-between gap-3 px-6 sm:px-7 py-5 border-b border-border bg-bg-secondary/40">
        <span className="font-sans text-[10px] font-bold tracking-[0.14em] uppercase text-text-dim">
          Live picks vs. the same money in the index
        </span>
        {lead !== null && (
          <span className="font-mono text-[11px] text-text-muted">
            {lead >= 0 ? "Ahead of" : "Behind"} the best benchmark by{" "}
            <span
              className={`font-bold ${lead >= 0 ? "text-accent-green" : "text-accent-red"}`}
            >
              {Math.abs(lead).toFixed(2)} pts
            </span>
          </span>
        )}
      </div>

      <div className="px-4 sm:px-7 py-6 sm:py-7">
        {picksLatestPct !== null && (
          <div className="flex items-end gap-3 mb-5 px-2 sm:px-0">
            <span
              className={`font-mono text-[40px] sm:text-[48px] font-bold leading-none tracking-tight ${
                picksLatestPct >= 0 ? "text-accent-green" : "text-accent-red"
              }`}
            >
              {formatChartPct(picksLatestPct)}
            </span>
            <span className="font-sans text-[12px] text-text-dim pb-1.5">
              on capital deployed into picks
            </span>
          </div>
        )}

        <div className="mb-4 px-2 sm:px-0">
          <PicksBenchmarkLegend comparison={comparison} compact />
        </div>

        <PicksBenchmarkChart comparison={comparison} height={height} compact />

        <div className="mt-5 px-2 sm:px-0">
          {benchmarks.length > 0 ? (
            <BenchmarkBasisNote startDate={startDate} />
          ) : (
            <p className="font-sans text-[11px] text-text-dim leading-relaxed">
              Index comparisons are unavailable right now — we show nothing
              rather than a placeholder line.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
