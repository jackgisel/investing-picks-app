"use client";

import { useStrategy } from "@/lib/hooks/use-strategy";
import { useChart } from "@/lib/hooks/use-chart";
import { PerformanceChart } from "@/components/dashboard/performance-chart";
import { LiveStatus } from "@/components/dashboard/live-status";
import { computePortfolioReturnPct, formatPct } from "@/lib/portfolio";
import { TrendingUp, BarChart3, Activity, Trophy } from "lucide-react";

const LIVE_INCEPTION = "2026-04-01";

function daysSince(dateStr: string): number {
  const start = new Date(dateStr).getTime();
  const now = Date.now();
  return Math.max(0, Math.floor((now - start) / (1000 * 60 * 60 * 24)));
}

export default function PerformancePage() {
  const { data: strategy, isLoading } = useStrategy();
  const { data: chartData } = useChart();

  const portfolio = strategy?.portfolio;
  const holdings = strategy?.holdings;

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

  const days = daysSince(LIVE_INCEPTION);
  const seriesPoints = chartData?.series?.length ?? 0;

  return (
    <div className="max-w-[1100px] space-y-6">
      <div>
        <h1 className="font-sans text-xl font-bold">Performance</h1>
        <p className="font-sans text-[13px] text-text-dim mt-1">
          Live portfolio tracking · Day {days} · {seriesPoints} data points
        </p>
      </div>

      <LiveStatus />

      {/* Live metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <MetricCard
          label="TOTAL RETURN"
          value={hasReturn ? formatPct(totalReturnPct) : "—"}
          icon={TrendingUp}
          green={hasReturn && totalReturnPct >= 0}
          red={hasReturn && totalReturnPct < 0}
          loading={isLoading}
        />
        <MetricCard
          label="POSITIONS"
          value={portfolio?.position_count.toString() ?? "—"}
          icon={BarChart3}
          loading={isLoading}
        />
        <MetricCard
          label="WINNERS"
          value={
            holdings ? `${winnersCount} / ${holdings.length}` : "—"
          }
          icon={Trophy}
          loading={isLoading}
        />
        <MetricCard
          label="DAYS LIVE"
          value={days.toString()}
          icon={Activity}
          loading={isLoading}
        />
      </div>

      {/* Live chart (will show empty state until enough data) */}
      <PerformanceChart />

      {/* Best & worst */}
      {(bestHolding || worstHolding) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {bestHolding && (
            <div className="bg-bg-secondary border border-border p-5">
              <span className="font-mono text-[10px] text-text-dim tracking-[2px] block mb-2">
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
            <div className="bg-bg-secondary border border-border p-5">
              <span className="font-mono text-[10px] text-text-dim tracking-[2px] block mb-2">
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

      <div className="bg-bg-secondary border border-border p-5">
        <p className="font-sans text-[12px] text-text-muted leading-relaxed">
          This page shows <strong className="text-text">only live performance</strong>.
          Historical strategy validation (the walk-forward backtest) is
          documented separately on the{" "}
          <a
            href="/dashboard/strategy"
            className="text-accent-green hover:underline"
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
    <div className="bg-bg-secondary border border-border p-5">
      <div className="flex items-center gap-2 mb-2">
        <Icon size={14} className="text-text-dim" />
        <span className="font-mono text-[10px] text-text-dim tracking-[1.5px]">
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
