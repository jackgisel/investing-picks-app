"use client";

import { useMemo } from "react";
import { buildPicksComparison, useChart } from "@/lib/hooks/use-chart";
import { DataState, resolveDataState } from "@/components/ui/data-state";
import {
  BenchmarkBasisNote,
  PicksBenchmarkChart,
  PicksBenchmarkLegend,
  formatChartPct,
  formatChartDate,
} from "@/components/ui/picks-benchmark-chart";
import { TrendingUp } from "lucide-react";
import { pnlClass } from "@/lib/portfolio";

function EmptyChart({ compact }: { compact?: boolean }) {
  return (
    <div
      className={`soft-card ${compact ? "h-56" : "h-80"} flex flex-col items-center justify-center`}
    >
      <TrendingUp size={28} className="text-text-dim mb-3" />
      <span className="font-sans text-[11px] font-bold tracking-[0.12em] uppercase text-text-dim">
        Building track record
      </span>
      <p className="font-sans text-[13px] text-text-muted mt-2 max-w-sm text-center">
        The picks curve populates once there are at least two days of marks on
        the capital deployed into picks.
      </p>
    </div>
  );
}

export function PerformanceChart({ compact = false }: { compact?: boolean }) {
  const { data: chartData, isPending, isError, error, refetch } = useChart();
  const comparison = useMemo(
    () => buildPicksComparison(chartData),
    [chartData]
  );

  if (isPending) {
    return (
      <div
        className={`soft-card ${compact ? "h-56" : "h-80"} flex items-center justify-center`}
      >
        <span className="font-sans text-[11px] font-bold tracking-[0.12em] uppercase text-text-dim animate-pulse">
          Loading chart data...
        </span>
      </div>
    );
  }

  // A failed fetch used to fall through to "Building track record", which
  // claims the series is merely short when in fact we never got one.
  if (isError) {
    const state = resolveDataState({
      isPending: false,
      isError: true,
      error,
      isEmpty: false,
    })!;
    return (
      <div
        className={`soft-card !p-0 ${compact ? "h-56" : "h-80"} flex items-center justify-center`}
      >
        <DataState state={state} error={error} onRetry={() => void refetch()} />
      </div>
    );
  }

  // Two points is the minimum that draws a line. Note this counts the PICKS
  // curve, not the legacy book-equity series — an API that only returns the old
  // shape gets the empty state rather than a book-equity line mislabelled as
  // picks.
  const picksPoints = comparison.rows.filter((r) => r.picks !== null).length;
  if (picksPoints < 2) {
    return <EmptyChart compact={compact} />;
  }

  const { benchmarks, picksLatestPct, startDate, latestDate } = comparison;

  return (
    <div className={`soft-card ${compact ? "!p-4" : ""}`}>
      <div
        className={`flex flex-wrap items-start justify-between gap-x-6 gap-y-3 ${
          compact ? "mb-3" : "mb-5"
        }`}
      >
        <div>
          <span className="font-sans text-[11px] font-bold tracking-[0.12em] uppercase text-text-dim">
            Return on capital deployed into picks
          </span>
          {!compact && (
            <p className="font-sans text-[13px] text-text-muted mt-1">
              Cumulative return since the first pick — idle cash excluded,
              closed picks included.
            </p>
          )}
        </div>
        {picksLatestPct !== null && (
          <div className="text-right">
            <span
              className={`font-mono text-[26px] font-bold leading-none ${pnlClass(
                picksLatestPct,
              )}`}
            >
              {formatChartPct(picksLatestPct)}
            </span>
            {latestDate && (
              <p className="font-mono text-[10px] text-text-dim mt-1.5">
                as of {formatChartDate(latestDate)}
              </p>
            )}
          </div>
        )}
      </div>

      <div className={compact ? "mb-3" : "mb-4"}>
        <PicksBenchmarkLegend comparison={comparison} compact={compact} />
      </div>

      <PicksBenchmarkChart
        comparison={comparison}
        height={compact ? 220 : 340}
        compact={compact}
      />

      {benchmarks.length > 0 && (
        <div className={compact ? "mt-3" : "mt-5"}>
          {!compact && picksLatestPct !== null && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
              {benchmarks.map((b) => {
                const gap =
                  b.latestPct === null ? null : picksLatestPct - b.latestPct;
                return (
                  <div
                    key={b.key}
                    className="rounded-soft border border-border px-4 py-3"
                  >
                    <p className="font-sans text-[10px] font-bold tracking-[0.12em] uppercase text-text-dim">
                      vs {b.label}
                    </p>
                    <p
                      className={`font-mono text-[18px] font-bold mt-1.5 leading-none ${pnlClass(
                        gap,
                      )}`}
                    >
                      {gap === null
                        ? "—"
                        : `${gap >= 0 ? "+" : ""}${gap.toFixed(2)} pts`}
                    </p>
                    <p className="font-mono text-[10px] text-text-dim mt-1.5">
                      {b.key} {b.latestPct === null ? "—" : formatChartPct(b.latestPct)}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
          <BenchmarkBasisNote startDate={startDate} />
        </div>
      )}

      {benchmarks.length === 0 && !compact && (
        <p className="font-sans text-[11px] text-text-dim leading-relaxed mt-5">
          Benchmark comparisons are unavailable right now — index price history
          did not load, and we would rather show nothing than a flat line.
        </p>
      )}
    </div>
  );
}
