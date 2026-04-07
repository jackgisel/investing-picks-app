"use client";

import { useStrategy } from "@/lib/hooks/use-strategy";
import { usePicks } from "@/lib/hooks/use-picks";
import { PerformanceChart } from "@/components/dashboard/performance-chart";
import { LiveStatus, BacktestBadge, BacktestDisclaimer } from "@/components/dashboard/live-status";
import {
  TrendingUp,
  BarChart3,
  Activity,
  Target,
  ArrowUpRight,
} from "lucide-react";
import Link from "next/link";

function formatPct(n: number) {
  const sign = n >= 0 ? "+" : "";
  return `${sign}${n.toFixed(2)}%`;
}

export default function DashboardPage() {
  const { data: strategy, isLoading } = useStrategy();
  const { data: picksData } = usePicks("active");

  const stats = strategy?.backtest;
  const holdings = strategy?.holdings;

  // Top holdings by backtest P&L
  const topHoldings = holdings
    ?.filter((h) => h.backtest_pnl_pct > 0)
    .sort((a, b) => b.backtest_pnl_pct - a.backtest_pnl_pct)
    .slice(0, 8);

  // Recent backtest picks
  const recentPicks = picksData?.picks
    .filter((p) => p.source === "backtest")
    .sort((a, b) => b.entry_date.localeCompare(a.entry_date))
    .slice(0, 3);

  return (
    <div className="max-w-[1100px] space-y-6">
      <div>
        <h1 className="font-sans text-xl font-bold">Dashboard</h1>
        <p className="font-sans text-[13px] text-text-dim mt-1">
          Strategy overview &middot; {strategy?.strategy.evaluation_frequency || "biweekly"} evaluation
        </p>
      </div>

      {/* Live status banner */}
      <LiveStatus />

      {/* Backtest section header */}
      <div className="pt-2">
        <div className="flex items-center gap-3 mb-1">
          <h2 className="font-sans text-[15px] font-bold">Strategy Performance</h2>
          <BacktestBadge />
        </div>
        <BacktestDisclaimer />
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          label="TOTAL RETURN"
          value={stats ? formatPct(stats.total_return_pct) : "—"}
          icon={TrendingUp}
          green
          loading={isLoading}
        />
        <StatCard
          label="VS S&P 500"
          value={stats ? formatPct(stats.total_return_pct - stats.benchmark_return_pct) : "—"}
          icon={BarChart3}
          green
          loading={isLoading}
        />
        <StatCard
          label="CAGR"
          value={stats ? formatPct(stats.cagr_pct) : "—"}
          icon={Activity}
          green
          loading={isLoading}
        />
        <StatCard
          label="WIN RATE"
          value={stats ? `${stats.win_rate_pct}%` : "—"}
          icon={Target}
          loading={isLoading}
        />
      </div>

      {/* Secondary metrics */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
        {[
          { label: "SHARPE", value: stats?.sharpe_ratio.toFixed(2) },
          { label: "MAX DD", value: stats ? `-${stats.max_drawdown_pct.toFixed(1)}%` : undefined },
          { label: "TRADES", value: stats?.total_trades.toString() },
          { label: "WINNERS", value: stats?.winners.toString() },
          { label: "LOSERS", value: stats?.losers.toString() },
          { label: "POSITIONS", value: strategy?.live.position_count.toString() },
        ].map((m) => (
          <div key={m.label} className="bg-bg-secondary border border-border p-4 text-center">
            <span className="font-mono text-[9px] text-text-dim tracking-[1.5px] block mb-1">
              {m.label}
            </span>
            <span className="font-mono text-[14px] font-semibold">
              {isLoading ? "—" : m.value ?? "—"}
            </span>
          </div>
        ))}
      </div>

      {/* Performance chart */}
      <PerformanceChart compact />

      {/* Holdings preview + Recent picks */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Top holdings */}
        <div className="lg:col-span-2 bg-bg-secondary border border-border">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border">
            <div className="flex items-center gap-2">
              <span className="font-mono text-[10px] text-text-dim tracking-[2px]">
                TOP HOLDINGS
              </span>
              <span className="font-mono text-[9px] text-text-dim">
                · BACKTEST P&L
              </span>
            </div>
            <Link
              href="/dashboard/portfolio"
              className="font-mono text-[10px] text-accent-green hover:underline flex items-center gap-1"
            >
              VIEW ALL <ArrowUpRight size={10} />
            </Link>
          </div>
          <div className="divide-y divide-border">
            {!topHoldings ? (
              <LoadingRow />
            ) : topHoldings.length === 0 ? (
              <EmptyRow text="NO HOLDINGS" />
            ) : (
              topHoldings.map((h) => (
                <div
                  key={`${h.ticker}-${h.source}`}
                  className="flex items-center justify-between px-5 py-3 hover:bg-bg-tertiary/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-[14px] font-semibold w-12">
                      {h.ticker}
                    </span>
                    <span className={`badge ${h.source === "live" ? "badge-buy" : "badge-hold"}`}>
                      {h.source === "live" ? "LIVE" : "BACKTEST ONLY"}
                    </span>
                  </div>
                  <span
                    className={`font-mono text-[13px] font-semibold ${
                      h.backtest_pnl_pct >= 0 ? "text-accent-green" : "text-accent-red"
                    }`}
                  >
                    {formatPct(h.backtest_pnl_pct)}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Recent picks */}
        <div className="bg-bg-secondary border border-border">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border">
            <span className="font-mono text-[10px] text-text-dim tracking-[2px]">
              RECENT PICKS
            </span>
            <Link
              href="/dashboard/picks"
              className="font-mono text-[10px] text-accent-green hover:underline flex items-center gap-1"
            >
              ALL PICKS <ArrowUpRight size={10} />
            </Link>
          </div>
          <div className="divide-y divide-border">
            {!recentPicks ? (
              <LoadingRow />
            ) : recentPicks.length === 0 ? (
              <EmptyRow text="NO PICKS YET" />
            ) : (
              recentPicks.map((p, i) => (
                <div key={`${p.ticker}-${i}`} className="px-5 py-4 hover:bg-bg-tertiary/50 transition-colors">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-mono text-[14px] font-semibold">{p.ticker}</span>
                    <span
                      className={`font-mono text-[12px] font-semibold ${
                        p.pnl_pct >= 0 ? "text-accent-green" : "text-accent-red"
                      }`}
                    >
                      {formatPct(p.pnl_pct)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[11px] text-text-dim">
                      Entry: ${p.entry_price.toFixed(2)}
                    </span>
                    <span className="font-mono text-[11px] text-text-dim">{p.entry_date}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  label, value, icon: Icon, green = false, loading = false,
}: {
  label: string; value: string; icon: React.ElementType; green?: boolean; loading?: boolean;
}) {
  return (
    <div className="bg-bg-secondary border border-border p-5">
      <div className="flex items-center gap-2 mb-2">
        <Icon size={14} className="text-text-dim" />
        <span className="font-mono text-[10px] text-text-dim tracking-[1.5px]">{label}</span>
      </div>
      <span className={`font-mono text-xl font-bold ${loading ? "text-text-dim animate-pulse" : green ? "text-accent-green" : "text-text"}`}>
        {value}
      </span>
    </div>
  );
}

function LoadingRow() {
  return (
    <div className="px-5 py-8 text-center">
      <span className="font-mono text-[11px] text-text-dim animate-pulse">LOADING...</span>
    </div>
  );
}

function EmptyRow({ text }: { text: string }) {
  return (
    <div className="px-5 py-8 text-center">
      <span className="font-mono text-[11px] text-text-dim">{text}</span>
    </div>
  );
}
