"use client";

import { useStrategy } from "@/lib/hooks/use-strategy";
import { usePicks } from "@/lib/hooks/use-picks";
import { LiveStatus } from "@/components/dashboard/live-status";
import {
  TrendingUp,
  Wallet,
  Activity,
  Layers,
  ArrowUpRight,
} from "lucide-react";
import Link from "next/link";

function formatPct(n: number) {
  const sign = n >= 0 ? "+" : "";
  return `${sign}${n.toFixed(2)}%`;
}

function formatCurrency(n: number) {
  return n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

function formatDollar(n: number) {
  const sign = n >= 0 ? "+" : "";
  return `${sign}$${Math.abs(n).toFixed(2)}`;
}

export default function DashboardPage() {
  const { data: strategy, isLoading } = useStrategy();
  const { data: picksData } = usePicks("active");

  const portfolio = strategy?.portfolio;
  const holdings = strategy?.holdings;
  const strategyMeta = strategy?.strategy;

  // Total return % from current vs cost basis
  const totalCost = holdings?.reduce(
    (sum, h) => sum + h.entry_price * h.shares,
    0
  ) ?? 0;
  const totalReturnPct = totalCost > 0 && portfolio
    ? ((portfolio.total_value - totalCost) / totalCost) * 100
    : 0;

  // Top 5 holdings by P&L
  const topHoldings = holdings
    ? [...holdings].sort((a, b) => b.pnl_pct - a.pnl_pct).slice(0, 5)
    : undefined;

  // Bottom 5 holdings by P&L
  const bottomHoldings = holdings
    ? [...holdings].sort((a, b) => a.pnl_pct - b.pnl_pct).slice(0, 5)
    : undefined;

  // Most recent picks (sorted by entry date desc)
  const recentPicks = picksData?.picks
    ? [...picksData.picks]
        .sort((a, b) => b.entry_date.localeCompare(a.entry_date))
        .slice(0, 4)
    : undefined;

  return (
    <div className="max-w-[1100px] space-y-6">
      <div>
        <h1 className="font-sans text-xl font-bold">Dashboard</h1>
        <p className="font-sans text-[13px] text-text-dim mt-1">
          {strategyMeta
            ? `${strategyMeta.name} · ${strategyMeta.evaluation_frequency} evaluation`
            : "Loading..."}
        </p>
      </div>

      {/* Live status banner */}
      <LiveStatus />

      {/* Live stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          label="PORTFOLIO VALUE"
          value={portfolio ? formatCurrency(portfolio.total_value) : "—"}
          icon={Wallet}
          loading={isLoading}
        />
        <StatCard
          label="UNREALIZED P&L"
          value={portfolio ? formatDollar(portfolio.total_unrealized_pnl) : "—"}
          icon={TrendingUp}
          green={portfolio ? portfolio.total_unrealized_pnl >= 0 : false}
          red={portfolio ? portfolio.total_unrealized_pnl < 0 : false}
          loading={isLoading}
        />
        <StatCard
          label="TOTAL RETURN"
          value={isLoading ? "—" : formatPct(totalReturnPct)}
          icon={Activity}
          green={totalReturnPct >= 0}
          red={totalReturnPct < 0}
          loading={isLoading}
        />
        <StatCard
          label="POSITIONS"
          value={portfolio ? portfolio.position_count.toString() : "—"}
          icon={Layers}
          loading={isLoading}
        />
      </div>

      {/* Top + Bottom holdings */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <HoldingsCard
          title="TOP PERFORMERS"
          holdings={topHoldings}
        />
        <HoldingsCard
          title="WORST PERFORMERS"
          holdings={bottomHoldings}
        />
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
              <div key={`${p.ticker}-${i}`} className="grid grid-cols-2 sm:grid-cols-4 items-center px-5 py-4 hover:bg-bg-tertiary/50 transition-colors gap-2">
                <span className="font-mono text-[14px] font-semibold">{p.ticker}</span>
                <span className="font-mono text-[11px] text-text-dim">
                  {p.entry_date}
                </span>
                <span className="font-mono text-[11px] text-text-dim hidden sm:block">
                  Entry ${p.entry_price.toFixed(2)}
                </span>
                <span
                  className={`font-mono text-[12px] font-semibold text-right ${
                    p.pnl_pct >= 0 ? "text-accent-green" : "text-accent-red"
                  }`}
                >
                  {formatPct(p.pnl_pct)}
                </span>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Curiosity nudge to Strategy page */}
      <Link
        href="/dashboard/strategy"
        className="block bg-bg-secondary border border-border p-5 hover:border-border-light transition-colors group"
      >
        <div className="flex items-center justify-between">
          <div>
            <span className="font-mono text-[10px] text-text-dim tracking-[2px] block mb-1">
              METHODOLOGY
            </span>
            <p className="font-sans text-[14px] font-semibold">
              How the strategy works &middot; Full backtest methodology
            </p>
            <p className="font-sans text-[12px] text-text-muted mt-1">
              Read the thesis, see the simulation results, understand the rules.
            </p>
          </div>
          <ArrowUpRight
            size={18}
            className="text-text-dim group-hover:text-accent-green transition-colors"
          />
        </div>
      </Link>
    </div>
  );
}

function StatCard({
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

function HoldingsCard({
  title,
  holdings,
}: {
  title: string;
  holdings: { ticker: string; pnl_pct: number; entry_price: number; current_price: number }[] | undefined;
}) {
  return (
    <div className="bg-bg-secondary border border-border">
      <div className="flex items-center justify-between px-5 py-4 border-b border-border">
        <span className="font-mono text-[10px] text-text-dim tracking-[2px]">
          {title}
        </span>
        <Link
          href="/dashboard/portfolio"
          className="font-mono text-[10px] text-accent-green hover:underline flex items-center gap-1"
        >
          VIEW ALL <ArrowUpRight size={10} />
        </Link>
      </div>
      <div className="divide-y divide-border">
        {!holdings ? (
          <LoadingRow />
        ) : holdings.length === 0 ? (
          <EmptyRow text="NO HOLDINGS" />
        ) : (
          holdings.map((h) => (
            <div
              key={h.ticker}
              className="flex items-center justify-between px-5 py-3 hover:bg-bg-tertiary/50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <span className="font-mono text-[14px] font-semibold w-14">
                  {h.ticker}
                </span>
                <span className="font-mono text-[11px] text-text-dim">
                  ${h.entry_price.toFixed(2)} → ${h.current_price.toFixed(2)}
                </span>
              </div>
              <span
                className={`font-mono text-[13px] font-semibold ${
                  h.pnl_pct >= 0 ? "text-accent-green" : "text-accent-red"
                }`}
              >
                {h.pnl_pct >= 0 ? "+" : ""}
                {h.pnl_pct.toFixed(2)}%
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function LoadingRow() {
  return (
    <div className="px-5 py-8 text-center">
      <span className="font-mono text-[11px] text-text-dim animate-pulse">
        LOADING...
      </span>
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
