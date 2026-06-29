"use client";

import { useStrategy } from "@/lib/hooks/use-strategy";
import { useChart } from "@/lib/hooks/use-chart";
import { BACKTEST } from "@/lib/constants";
import {
  computeAnnualizedReturn,
  computePortfolioReturnPct,
  countDoubledWinners,
  daysSinceInception,
  liveAccrualDays,
  formatPct,
} from "@/lib/portfolio";

export function StatsBar() {
  const { data: strategy } = useStrategy();
  const { data: chart } = useChart();
  const totalReturnPct = computePortfolioReturnPct(strategy);
  const days = daysSinceInception();
  const accrualDays = liveAccrualDays(chart?.summary);
  const hasReturn = totalReturnPct !== null;
  const liveCagr = hasReturn
    ? computeAnnualizedReturn(totalReturnPct!, accrualDays)
    : null;
  const liveDoubled = countDoubledWinners(strategy?.holdings);

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
                LIVE EXAMPLE PORTFOLIO
              </span>
              <span className="font-mono text-[10px] text-text-dim">
                · Day {days}
              </span>
            </div>
            <div className="flex items-center gap-6 sm:gap-10">
              <Stat
                label="LIVE CAGR"
                value={liveCagr !== null ? formatPct(liveCagr) : "—"}
                green={liveCagr !== null && liveCagr >= 0}
                red={liveCagr !== null && liveCagr < 0}
              />
              <Stat
                label="2× WINNERS"
                value={liveDoubled > 0 ? liveDoubled.toString() : "—"}
                green={liveDoubled > 0}
              />
              <Stat
                label="TOTAL RETURN"
                value={hasReturn ? formatPct(totalReturnPct!) : "—"}
                green={hasReturn ? totalReturnPct! >= 0 : false}
                red={hasReturn ? totalReturnPct! < 0 : false}
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
              5-YR MODEL · WALK-FORWARD
            </span>
            <span className="font-mono text-[9px] tracking-[1.5px] font-bold bg-bg-tertiary text-text-muted px-2 py-0.5 inline-block border border-border">
              SIMULATED
            </span>
          </div>
          <div className="flex items-center gap-6 sm:gap-10">
            <Stat label="CAGR" value={BACKTEST.cagr} green />
            <Stat
              label="2× WINNERS"
              value={BACKTEST.winnersCircle.toString()}
              green
            />
            <Stat label="WIN RATE" value={BACKTEST.winRate} green />
            <Stat label="VS S&P" value={BACKTEST.alpha} green />
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
