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
import { TrendingUp } from "lucide-react";

function formatCurrency(value: number) {
  if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`;
  return `$${value.toFixed(0)}`;
}

function EmptyChart({ compact }: { compact?: boolean }) {
  return (
    <div
      className={`bg-bg-secondary border border-border ${compact ? "h-56" : "h-80"} flex flex-col items-center justify-center px-6`}
    >
      <TrendingUp size={28} className="text-text-dim mb-3" />
      <span className="font-mono text-[11px] text-text-dim tracking-[1.5px]">
        BUILDING TRACK RECORD
      </span>
      <p className="font-sans text-[12px] text-text-muted mt-2 max-w-sm text-center">
        Live performance chart will populate as the portfolio accrues daily
        history. Started Apr 1, 2026.
      </p>
    </div>
  );
}

export function PerformanceChart({ compact = false }: { compact?: boolean }) {
  const { data: chartData, isLoading } = useChart();
  const series = chartData?.series ?? [];

  if (isLoading) {
    return (
      <div
        className={`bg-bg-secondary border border-border ${compact ? "h-56" : "h-80"} flex items-center justify-center`}
      >
        <span className="font-mono text-[11px] text-text-dim animate-pulse">
          LOADING CHART DATA...
        </span>
      </div>
    );
  }

  // Need at least 2 points for a meaningful chart
  if (series.length < 2) {
    return <EmptyChart compact={compact} />;
  }

  // Normalize benchmark to portfolio start (if benchmark exists)
  const firstBenchmark = series[0]?.benchmark_value;
  const firstPortfolio = series[0]?.portfolio_value || 1;
  const data = series.map((d: ChartPoint) => ({
    date: d.date,
    portfolio: d.portfolio_value,
    benchmark: firstBenchmark
      ? (d.benchmark_value! / firstBenchmark) * firstPortfolio
      : null,
  }));

  return (
    <div className={`bg-bg-secondary border border-border ${compact ? "p-4" : "p-6"}`}>
      <div className={`flex items-center justify-between ${compact ? "mb-3" : "mb-4"}`}>
        <div>
          <span className="font-mono text-[10px] text-text-dim tracking-[2px]">
            LIVE PORTFOLIO VALUE
          </span>
          {!compact && (
            <p className="font-sans text-[12px] text-text-muted mt-1">
              Daily portfolio value since inception (Apr 1, 2026)
            </p>
          )}
        </div>
        {firstBenchmark && (
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
        )}
      </div>
      <ResponsiveContainer width="100%" height={compact ? 220 : 350}>
        <AreaChart data={data} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
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
            tickFormatter={(d: string) => d.slice(5)}
            stroke="#252525"
          />
          <YAxis
            tick={{ fontSize: 10, fill: "#666", fontFamily: "IBM Plex Mono" }}
            tickFormatter={formatCurrency}
            stroke="#252525"
            width={65}
            domain={["dataMin - 500", "dataMax + 500"]}
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
          {firstBenchmark && (
            <Area
              type="monotone"
              dataKey="benchmark"
              stroke="#666"
              strokeWidth={1}
              fill="none"
              dot={false}
            />
          )}
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
