"use client";

import { useStrategy } from "@/lib/hooks/use-strategy";
import { useChart } from "@/lib/hooks/use-chart";
import { PerformanceChart } from "@/components/dashboard/performance-chart";
import { BacktestBadge, BacktestDisclaimer } from "@/components/dashboard/live-status";
import { TrendingUp, BarChart3, Activity, ArrowDown } from "lucide-react";

function formatPct(n: number) {
  const sign = n >= 0 ? "+" : "";
  return `${sign}${n.toFixed(2)}%`;
}

export default function PerformancePage() {
  const { data: strategy, isLoading } = useStrategy();
  const { data: chartData } = useChart();
  const stats = strategy?.backtest;

  // Calculate chart-derived stats
  const chartStats = (() => {
    if (!chartData?.series || chartData.series.length < 2) return null;
    const series = chartData.series;
    const first = series[0];
    const last = series[series.length - 1];

    let peak = first.portfolio_value;
    let maxDD = 0;
    let maxDDDate = first.date;
    for (const point of series) {
      if (point.portfolio_value > peak) peak = point.portfolio_value;
      const dd = ((point.portfolio_value - peak) / peak) * 100;
      if (dd < maxDD) { maxDD = dd; maxDDDate = point.date; }
    }

    return {
      startValue: first.portfolio_value,
      endValue: last.portfolio_value,
      startDate: first.date,
      endDate: last.date,
      dataPoints: series.length,
      maxDD,
      maxDDDate,
    };
  })();

  return (
    <div className="max-w-[1100px] space-y-6">
      <div>
        <div className="flex items-center gap-3 mb-1">
          <h1 className="font-sans text-xl font-bold">Performance</h1>
          <BacktestBadge />
        </div>
        <p className="font-sans text-[13px] text-text-dim mt-1">
          {stats ? `${stats.period} · ${chartStats?.dataPoints ?? 0} data points` : "Loading..."}
        </p>
        <BacktestDisclaimer />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <MetricCard label="TOTAL RETURN" value={stats ? formatPct(stats.total_return_pct) : "—"} icon={TrendingUp} green loading={isLoading} />
        <MetricCard label="CAGR" value={stats ? formatPct(stats.cagr_pct) : "—"} icon={Activity} green loading={isLoading} />
        <MetricCard label="SHARPE RATIO" value={stats ? stats.sharpe_ratio.toFixed(2) : "—"} icon={BarChart3} loading={isLoading} />
        <MetricCard label="MAX DRAWDOWN" value={stats ? `-${stats.max_drawdown_pct.toFixed(2)}%` : "—"} icon={ArrowDown} red loading={isLoading} />
      </div>

      <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
        {[
          { label: "WIN RATE", value: stats ? `${stats.win_rate_pct}%` : "—" },
          { label: "WINNERS", value: stats?.winners.toString() ?? "—" },
          { label: "LOSERS", value: stats?.losers.toString() ?? "—" },
          { label: "TOTAL TRADES", value: stats?.total_trades.toString() ?? "—" },
          { label: "S&P 500", value: stats ? formatPct(stats.benchmark_return_pct) : "—" },
          { label: "ALPHA", value: stats ? formatPct(stats.total_return_pct - stats.benchmark_return_pct) : "—" },
        ].map((m) => (
          <div key={m.label} className="bg-bg-secondary border border-border p-4 text-center">
            <span className="font-mono text-[9px] text-text-dim tracking-[1.5px] block mb-1">{m.label}</span>
            <span className="font-mono text-[14px] font-semibold">{m.value}</span>
          </div>
        ))}
      </div>

      <PerformanceChart />

      {chartStats && (
        <div className="bg-bg-secondary border border-border p-6">
          <span className="font-mono text-[10px] text-text-dim tracking-[2px] block mb-4">CHART SUMMARY</span>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
            <div>
              <span className="font-mono text-[10px] text-text-dim block mb-1">START VALUE</span>
              <span className="font-mono text-[14px] font-semibold">${(chartStats.startValue / 1000).toFixed(0)}K</span>
            </div>
            <div>
              <span className="font-mono text-[10px] text-text-dim block mb-1">END VALUE</span>
              <span className="font-mono text-[14px] font-semibold text-accent-green">${(chartStats.endValue / 1000).toFixed(0)}K</span>
            </div>
            <div>
              <span className="font-mono text-[10px] text-text-dim block mb-1">MAX DRAWDOWN</span>
              <span className="font-mono text-[14px] font-semibold text-accent-red">{chartStats.maxDD.toFixed(2)}%</span>
              <span className="font-mono text-[10px] text-text-dim block">{chartStats.maxDDDate}</span>
            </div>
            <div>
              <span className="font-mono text-[10px] text-text-dim block mb-1">PERIOD</span>
              <span className="font-mono text-[13px]">{chartStats.startDate} → {chartStats.endDate}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function MetricCard({ label, value, icon: Icon, green = false, red = false, loading = false }: {
  label: string; value: string; icon: React.ElementType; green?: boolean; red?: boolean; loading?: boolean;
}) {
  return (
    <div className="bg-bg-secondary border border-border p-5">
      <div className="flex items-center gap-2 mb-2">
        <Icon size={14} className="text-text-dim" />
        <span className="font-mono text-[10px] text-text-dim tracking-[1.5px]">{label}</span>
      </div>
      <span className={`font-mono text-xl font-bold ${loading ? "text-text-dim animate-pulse" : red ? "text-accent-red" : green ? "text-accent-green" : "text-text"}`}>
        {value}
      </span>
    </div>
  );
}
