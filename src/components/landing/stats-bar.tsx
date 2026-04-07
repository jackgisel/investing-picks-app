"use client";

import { useStrategy } from "@/lib/hooks/use-strategy";
import { BACKTEST } from "@/lib/constants";

const LIVE_INCEPTION = "2026-04-01";

function daysSince(dateStr: string): number {
  const start = new Date(dateStr).getTime();
  const now = Date.now();
  return Math.max(0, Math.floor((now - start) / (1000 * 60 * 60 * 24)));
}

function formatCurrency(n: number) {
  if (Math.abs(n) >= 1000) return `$${(n / 1000).toFixed(1)}K`;
  return `$${n.toFixed(0)}`;
}

export function StatsBar() {
  const { data: strategy } = useStrategy();
  const portfolio = strategy?.portfolio;
  const days = daysSince(LIVE_INCEPTION);

  return (
    <section className="border-y border-border">
      {/* LIVE row */}
      <div className="border-b border-border bg-bg-secondary/30">
        <div className="container-op py-5">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-3">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent-green opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-accent-green" />
              </span>
              <span className="font-mono text-[10px] text-accent-green tracking-[2px] font-semibold">
                LIVE PORTFOLIO
              </span>
              <span className="font-mono text-[10px] text-text-dim">
                · Day {days}
              </span>
            </div>
            <div className="flex items-center gap-6 sm:gap-10">
              <Stat label="POSITIONS" value={portfolio?.position_count?.toString() ?? "—"} />
              <Stat
                label="VALUE"
                value={portfolio ? formatCurrency(portfolio.total_value) : "—"}
              />
              <Stat
                label="UNREALIZED"
                value={
                  portfolio
                    ? `${portfolio.total_unrealized_pnl >= 0 ? "+" : ""}$${portfolio.total_unrealized_pnl.toFixed(0)}`
                    : "—"
                }
                green={portfolio ? portfolio.total_unrealized_pnl >= 0 : false}
                red={portfolio ? portfolio.total_unrealized_pnl < 0 : false}
              />
            </div>
          </div>
        </div>
      </div>

      {/* BACKTEST row */}
      <div className="container-op py-5">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <span className="font-mono text-[10px] text-text-dim tracking-[2px] font-semibold">
              STRATEGY BACKTEST
            </span>
            <span className="font-mono text-[9px] tracking-[1.5px] font-bold bg-bg-tertiary text-text-muted px-2 py-0.5 inline-block border border-border">
              SIMULATED
            </span>
          </div>
          <div className="flex items-center gap-6 sm:gap-10">
            <Stat label="RETURN" value={BACKTEST.totalReturn} green />
            <Stat label="CAGR" value={BACKTEST.cagr} green />
            <Stat label="VS S&P" value={BACKTEST.alpha} green />
            <Stat label="SHARPE" value={BACKTEST.sharpe} />
          </div>
        </div>
      </div>
    </section>
  );
}

function Stat({
  label,
  value,
  green = false,
  red = false,
}: {
  label: string;
  value: string;
  green?: boolean;
  red?: boolean;
}) {
  return (
    <div className="text-right">
      <p className="font-mono text-[9px] text-text-dim tracking-[1.5px] mb-0.5">
        {label}
      </p>
      <p
        className={`font-mono text-[15px] font-bold ${
          red ? "text-accent-red" : green ? "text-accent-green" : "text-text"
        }`}
      >
        {value}
      </p>
    </div>
  );
}
