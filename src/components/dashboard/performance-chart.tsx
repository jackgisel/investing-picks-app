"use client";

import { useChart, type ChartPoint } from "@/lib/hooks/use-chart";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { useMemo } from "react";

function formatCurrency(value: number) {
  if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`;
  return `$${value.toFixed(0)}`;
}

export function PerformanceChart({ compact = false }: { compact?: boolean }) {
  const { data: chartData, isLoading } = useChart();

  const data = useMemo(() => {
    if (!chartData?.series) return [];
    const series = chartData.series;
    if (compact && series.length > 200) {
      return series.filter((_: ChartPoint, i: number) => i % 5 === 0 || i === series.length - 1);
    }
    return series;
  }, [chartData, compact]);

  if (isLoading) {
    return (
      <div className={`bg-bg-secondary border border-border ${compact ? "h-64" : "h-96"} flex items-center justify-center`}>
        <span className="font-mono text-[11px] text-text-dim animate-pulse">
          LOADING CHART DATA...
        </span>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className={`bg-bg-secondary border border-border ${compact ? "h-64" : "h-96"} flex items-center justify-center`}>
        <span className="font-mono text-[11px] text-text-dim">
          NO CHART DATA AVAILABLE
        </span>
      </div>
    );
  }

  // Normalize benchmark to $100K start
  const firstBenchmark = data[0]?.benchmark_value || 1;
  const normalizedData = data.map((d: ChartPoint) => ({
    date: d.date,
    portfolio: d.portfolio_value,
    benchmark: (d.benchmark_value / firstBenchmark) * 100000,
  }));

  return (
    <div className={`bg-bg-secondary border border-border p-4 ${compact ? "" : "p-6"}`}>
      {compact ? (
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="font-mono text-[10px] text-text-dim tracking-[2px]">
              PORTFOLIO VS S&P 500
            </span>
            <span className="font-mono text-[9px] tracking-[1.5px] font-bold bg-bg-tertiary text-text-muted px-2 py-0.5 inline-block border border-border">
              7YR BACKTEST
            </span>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-0.5 bg-accent-green inline-block" />
              <span className="font-mono text-[9px] text-text-dim">PORTFOLIO</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-0.5 bg-text-dim inline-block" />
              <span className="font-mono text-[9px] text-text-dim">S&P 500</span>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-[10px] text-text-dim tracking-[2px]">
                PORTFOLIO VS S&P 500
              </span>
              <span className="font-mono text-[9px] tracking-[1.5px] font-bold bg-bg-tertiary text-text-muted px-2 py-0.5 inline-block border border-border">
                7YR BACKTEST
              </span>
            </div>
            <p className="font-sans text-[12px] text-text-muted mt-1">
              $100K starting capital, walk-forward simulation, Apr 2019 — Apr 2026
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="w-3 h-0.5 bg-accent-green inline-block" />
              <span className="font-mono text-[10px] text-text-dim">PORTFOLIO</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-0.5 bg-text-dim inline-block" />
              <span className="font-mono text-[10px] text-text-dim">S&P 500</span>
            </div>
          </div>
        </div>
      )}
      <ResponsiveContainer width="100%" height={compact ? 220 : 350}>
        <AreaChart data={normalizedData} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
          <defs>
            <linearGradient id="portfolioGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#22C55E" stopOpacity={0.15} />
              <stop offset="100%" stopColor="#22C55E" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#252525" vertical={false} />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 10, fill: "#666", fontFamily: "IBM Plex Mono" }}
            tickFormatter={(d: string) => d.slice(0, 7)}
            interval={Math.floor(normalizedData.length / (compact ? 4 : 6))}
            stroke="#252525"
          />
          <YAxis
            tick={{ fontSize: 10, fill: "#666", fontFamily: "IBM Plex Mono" }}
            tickFormatter={formatCurrency}
            stroke="#252525"
            width={65}
          />
          <Tooltip
            contentStyle={{
              background: "#141414",
              border: "1px solid #252525",
              borderRadius: 0,
              fontFamily: "IBM Plex Mono",
              fontSize: 11,
            }}
            labelStyle={{ color: "#999", fontSize: 10 }}
            formatter={(value: unknown, name: unknown) => [
              formatCurrency(Number(value)),
              name === "portfolio" ? "Portfolio" : "S&P 500",
            ]}
          />
          <Area
            type="monotone"
            dataKey="benchmark"
            stroke="#666"
            strokeWidth={1}
            fill="none"
            dot={false}
          />
          <Area
            type="monotone"
            dataKey="portfolio"
            stroke="#22C55E"
            strokeWidth={1.5}
            fill="url(#portfolioGrad)"
            dot={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
