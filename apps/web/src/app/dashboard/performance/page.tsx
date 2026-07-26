"use client";

import { useStrategy } from "@/lib/hooks/use-strategy";
import { useChart } from "@/lib/hooks/use-chart";
import { PerformanceChart } from "@/components/dashboard/performance-chart";
import { LiveStatus } from "@/components/dashboard/live-status";
import { DataStateCard, resolveDataState } from "@/components/ui/data-state";
import { useInceptionDate } from "@/lib/hooks/use-inception";
import {
  computePortfolioReturnPct,
  daysSinceInception,
  formatPct,
} from "@/lib/portfolio";
import { TrendingUp, BarChart3, Activity, Trophy } from "lucide-react";

export default function PerformancePage() {
  const strategyQuery = useStrategy();
  const chartQuery = useChart();
  const { inceptionISO } = useInceptionDate();
  const { data: strategy, isPending, isError, error } = strategyQuery;
  const { data: chartData } = chartQuery;

  const portfolio = strategy?.portfolio;
  const holdings = strategy?.holdings;

  const strategyState = resolveDataState({
    isPending,
    isError,
    error,
    isEmpty: false, // an empty book is still a valid page here — metrics render as 0
  });
  const chartState = resolveDataState({
    isPending: chartQuery.isPending,
    isError: chartQuery.isError,
    error: chartQuery.error,
    isEmpty: false,
  });
  // Both endpoints sit behind the same gate; either reporting one means the
  // whole page is unavailable, so show a single prompt instead of a grid of
  // dashes above an empty chart.
  const gate =
    strategyState === "unauthenticated" || strategyState === "subscription"
      ? strategyState
      : chartState === "unauthenticated" || chartState === "subscription"
        ? chartState
        : null;

  // Portfolio total return % derived from holdings — UI never shows dollars.
  const computedReturnPct = computePortfolioReturnPct(strategy);
  const totalReturnPct = computedReturnPct ?? 0;
  const hasReturn = computedReturnPct !== null;
  const winnersCount = holdings?.filter((h) => h.pnl_pct > 0).length ?? 0;

  // Best & worst current holdings
  const bestHolding = holdings
    ? [...holdings].sort((a, b) => b.pnl_pct - a.pnl_pct)[0]
    : null;
  const worstHolding = holdings
    ? [...holdings].sort((a, b) => a.pnl_pct - b.pnl_pct)[0]
    : null;

  const days = daysSinceInception(inceptionISO);
  // Count the picks curve, not the legacy book-equity series — that is what the
  // chart below actually plots, so the two must agree.
  const seriesPoints = chartData?.picks_series?.length ?? 0;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="page-title">Performance</h1>
        <p className="font-sans text-[13px] text-text-dim mt-1">
          {gate
            ? gate === "subscription"
              ? "Subscription required"
              : "Sign in to continue"
            : `Live portfolio tracking · Day ${days}${
                chartQuery.isSuccess ? ` · ${seriesPoints} data points` : ""
              }`}
        </p>
      </div>

      {gate ? (
        <DataStateCard state={gate} error={error ?? chartQuery.error} />
      ) : (
        <>
        <LiveStatus />

        {/* Live metrics */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <MetricCard
            label="PICKS RETURN"
            value={hasReturn ? formatPct(totalReturnPct) : "—"}
            icon={TrendingUp}
            green={hasReturn && totalReturnPct >= 0}
            red={hasReturn && totalReturnPct < 0}
            loading={isPending}
          />
          <MetricCard
            label="POSITIONS"
            value={portfolio?.position_count.toString() ?? "—"}
            icon={BarChart3}
            loading={isPending}
          />
          <MetricCard
            label="WINNERS"
            value={
              holdings ? `${winnersCount} / ${holdings.length}` : "—"
            }
            icon={Trophy}
            loading={isPending}
          />
          <MetricCard
            label="DAYS LIVE"
            value={days.toString()}
            icon={Activity}
            loading={isPending}
          />
        </div>

        {strategyState === "error" && (
          <DataStateCard
            state="error"
            error={error}
            onRetry={() => void strategyQuery.refetch()}
          />
        )}

        {/* Live chart (will show empty state until enough data) */}
        <PerformanceChart />

        {/* Best & worst */}
        {(bestHolding || worstHolding) && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {bestHolding && (
              <div className="data-card">
                <span className="font-sans text-[11px] font-bold tracking-[0.12em] uppercase text-text-dim block mb-2">
                  BEST HOLDING
                </span>
                <div className="flex items-baseline justify-between">
                  <span className="font-mono text-lg font-bold">
                    {bestHolding.ticker}
                  </span>
                  <span
                    className={`font-mono text-[18px] font-bold ${
                      bestHolding.pnl_pct >= 0
                        ? "text-accent-green"
                        : "text-accent-red"
                    }`}
                  >
                    {formatPct(bestHolding.pnl_pct)}
                  </span>
                </div>
                <span className="font-mono text-[11px] text-text-dim mt-1 block">
                  Entered {bestHolding.entry_date}
                </span>
              </div>
            )}
            {worstHolding && (
              <div className="data-card">
                <span className="font-sans text-[11px] font-bold tracking-[0.12em] uppercase text-text-dim block mb-2">
                  WORST HOLDING
                </span>
                <div className="flex items-baseline justify-between">
                  <span className="font-mono text-lg font-bold">
                    {worstHolding.ticker}
                  </span>
                  <span
                    className={`font-mono text-[18px] font-bold ${
                      worstHolding.pnl_pct >= 0
                        ? "text-accent-green"
                        : "text-accent-red"
                    }`}
                  >
                    {formatPct(worstHolding.pnl_pct)}
                  </span>
                </div>
                <span className="font-mono text-[11px] text-text-dim mt-1 block">
                  Entered {worstHolding.entry_date}
                </span>
              </div>
            )}
          </div>
        )}
        </>
      )}

      <div className="data-card">
        <p className="font-sans text-[12px] text-text-muted leading-relaxed">
          This page shows <strong className="text-text">only live performance</strong>.
          Historical strategy validation (the walk-forward backtest) is
          documented separately on the{" "}
          <a
            href="/dashboard/strategy"
            className="text-text font-semibold underline underline-offset-2 hover:opacity-70"
          >
            Strategy
          </a>{" "}
          page so live results are never confused with simulation.
        </p>
      </div>
    </div>
  );
}

function MetricCard({
  label,
  value,
  icon: Icon,
  green = false,
  red = false,
  loading = false,
}: {
  label: string;
  value: string;
  icon: React.ElementType;
  green?: boolean;
  red?: boolean;
  loading?: boolean;
}) {
  return (
    <div className="data-card">
      <div className="flex items-center gap-2 mb-2">
        <Icon size={14} className="text-text-dim" />
        <span className="font-sans text-[11px] font-bold tracking-[0.1em] uppercase text-text-dim">
          {label}
        </span>
      </div>
      <span
        className={`font-mono text-xl font-bold ${
          loading
            ? "text-text-dim animate-pulse"
            : red
              ? "text-accent-red"
              : green
                ? "text-accent-green"
                : "text-text"
        }`}
      >
        {value}
      </span>
    </div>
  );
}
