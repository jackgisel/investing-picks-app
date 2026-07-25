"use client";

import { useChart, type ChartPoint } from "@/lib/hooks/use-chart";
import { DataState, resolveDataState } from "@/components/ui/data-state";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { TrendingUp } from "lucide-react";

function formatPctTick(value: number) {
  const sign = value >= 0 ? "+" : "";
  return `${sign}${value.toFixed(1)}%`;
}

function formatPctTooltip(value: number) {
  const sign = value >= 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

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
        Live performance chart will populate as the portfolio accrues daily
        history. Started Apr 1, 2026.
      </p>
    </div>
  );
}

export function PerformanceChart({ compact = false }: { compact?: boolean }) {
  const { data: chartData, isPending, isError, error, refetch } = useChart();
  const series = chartData?.series ?? [];

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

  if (series.length < 2) {
    return <EmptyChart compact={compact} />;
  }

  const hasBenchmark = series.some((d) => d.benchmark_pct !== null);
  const data = series.map((d: ChartPoint) => ({
    date: d.date,
    portfolio: d.portfolio_pct ?? 0,
    benchmark: d.benchmark_pct,
  }));

  return (
    <div className={`soft-card ${compact ? "!p-4" : ""}`}>
      <div className={`flex items-center justify-between ${compact ? "mb-3" : "mb-4"}`}>
        <div>
          <span className="font-sans text-[11px] font-bold tracking-[0.12em] uppercase text-text-dim">
            Live portfolio return
          </span>
          {!compact && (
            <p className="font-sans text-[13px] text-text-muted mt-1">
              Cumulative % return since inception (Apr 1, 2026)
            </p>
          )}
        </div>
        {hasBenchmark && (
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-0.5 bg-accent-green inline-block" />
              <span className="font-sans text-[10px] font-semibold uppercase text-text-dim">
                Portfolio
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-0.5 bg-text-dim inline-block" />
              <span className="font-sans text-[10px] font-semibold uppercase text-text-dim">
                S&P 500
              </span>
            </div>
          </div>
        )}
      </div>
      <ResponsiveContainer width="100%" height={compact ? 220 : 350}>
        <AreaChart data={data} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
          <defs>
            <linearGradient id="portfolioGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#16A34A" stopOpacity={0.18} />
              <stop offset="100%" stopColor="#16A34A" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#E5E5E5" vertical={false} />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 10, fill: "#737373", fontFamily: "IBM Plex Mono" }}
            tickFormatter={(d: string) => d.slice(5)}
            stroke="#E5E5E5"
          />
          <YAxis
            tick={{ fontSize: 10, fill: "#737373", fontFamily: "IBM Plex Mono" }}
            tickFormatter={formatPctTick}
            stroke="#E5E5E5"
            width={55}
            domain={["dataMin - 1", "dataMax + 1"]}
          />
          <Tooltip
            contentStyle={{
              background: "#FFFFFF",
              border: "1px solid #E5E5E5",
              borderRadius: 16,
              fontFamily: "IBM Plex Mono",
              fontSize: 11,
              boxShadow: "0 8px 24px rgba(0,0,0,0.06)",
            }}
            labelStyle={{ color: "#737373", fontSize: 10 }}
            formatter={(value: unknown, name: unknown) => [
              formatPctTooltip(Number(value)),
              name === "portfolio" ? "Portfolio" : "S&P 500",
            ]}
          />
          {hasBenchmark && (
            <Area
              type="monotone"
              dataKey="benchmark"
              stroke="#A3A3A3"
              strokeWidth={1.5}
              fill="none"
              dot={false}
            />
          )}
          <Area
            type="monotone"
            dataKey="portfolio"
            stroke="#16A34A"
            strokeWidth={2}
            fill="url(#portfolioGrad)"
            dot={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
