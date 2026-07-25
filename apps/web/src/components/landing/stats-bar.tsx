"use client";

import { useStrategy } from "@/lib/hooks/use-strategy";
import { useChart } from "@/lib/hooks/use-chart";
import { BACKTEST } from "@/lib/constants";
import {
  computePortfolioReturnPct,
  countDoubledWinners,
  describeLiveCagr,
  resolveLiveCagr,
  formatPct,
} from "@/lib/portfolio";

export function StatsBar() {
  const { data: strategy } = useStrategy();
  const { data: chart } = useChart();
  const totalReturnPct = computePortfolioReturnPct(strategy);
  const hasReturn = totalReturnPct !== null;
  // Same resolver the track-record card uses, so "Day N" and the CAGR window
  // are one number rather than two that can disagree by two orders of magnitude.
  const cagr = resolveLiveCagr(totalReturnPct, chart?.summary);
  const days = cagr.daysLive;
  const cagrNote = describeLiveCagr(cagr);
  const liveDoubled = countDoubledWinners(strategy?.holdings);

  return (
      <section className="relative border-y border-border overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_120%_at_15%_50%,rgba(245,215,110,0.07),transparent_60%)]"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.3]"
          style={{
            backgroundImage:
              "radial-gradient(circle at 1px 1px, rgb(var(--color-text) / 0.05) 1px, transparent 0)",
            backgroundSize: "22px 22px",
          }}
        />

        <div className="container-op relative py-7 sm:py-9">
          <div className="flex flex-col xl:flex-row xl:items-stretch gap-8 xl:gap-0">
            <div className="op-animate-rise xl:flex-[1.05] xl:pr-10 xl:border-r xl:border-border/80">
              <div className="flex items-center gap-2.5 mb-3">
                <span className="relative flex h-2 w-2 shrink-0" aria-hidden>
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent-green opacity-60" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-accent-green" />
                </span>
                <p className="font-sans text-[10px] font-bold tracking-[0.16em] uppercase text-text-dim op-live-glow">
                  Live example portfolio · Day {days}
                </p>
              </div>
              {/* When the window is too short to annualize, the realized total
                  return leads instead. Showing a real number beats an
                  unexplained em-dash, and beats a projection dressed up as a
                  result. */}
              <div className="flex flex-wrap items-baseline gap-x-6 gap-y-2">
                {cagr.value !== null ? (
                  <>
                    <p className="font-mono text-[26px] sm:text-[30px] font-bold tracking-tight text-accent-green">
                      {formatPct(cagr.value)}
                      <span className="font-sans text-[11px] font-bold tracking-[0.14em] uppercase text-text-dim ml-2 align-middle">
                        CAGR
                      </span>
                    </p>
                    <p className="font-mono text-[17px] font-bold text-text">
                      {hasReturn ? formatPct(totalReturnPct!) : "—"}
                      <span className="font-sans text-[10px] font-bold tracking-[0.12em] uppercase text-text-dim ml-2">
                        total
                      </span>
                    </p>
                  </>
                ) : (
                  <p className="font-mono text-[26px] sm:text-[30px] font-bold tracking-tight text-accent-green">
                    {hasReturn ? formatPct(totalReturnPct!) : "—"}
                    <span className="font-sans text-[11px] font-bold tracking-[0.14em] uppercase text-text-dim ml-2 align-middle">
                      total return
                    </span>
                  </p>
                )}
                {liveDoubled > 0 && (
                  <p className="font-mono text-[15px] font-bold text-accent-green">
                    {liveDoubled}× doubled
                  </p>
                )}
              </div>
              {cagrNote && (
                <p className="font-sans text-[10px] text-text-dim mt-2 leading-snug max-w-[46ch]">
                  {cagrNote}
                </p>
              )}
            </div>

            <div className="op-animate-rise op-animate-rise-delay-1 xl:flex-1 xl:pl-10">
              <div className="flex items-center justify-between gap-3 mb-3">
                <p className="font-sans text-[10px] font-bold tracking-[0.16em] uppercase text-text-dim">
                  5-year walk-forward model
                </p>
                <span className="badge bg-bg-tertiary text-text-muted shrink-0">
                  Simulated
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 sm:gap-8">
                <Stat label="5-yr CAGR" value={BACKTEST.cagr} hero />
                <Stat label="2× winners" value={String(BACKTEST.winnersCircle)} />
                <Stat label="Win rate" value={BACKTEST.winRate} />
                <Stat label="vs S&P" value={BACKTEST.alpha} />
              </div>
            </div>
          </div>
        </div>
      </section>
  );
}

function Stat({
  label,
  value,
  hero = false,
}: {
  label: string;
  value: string;
  hero?: boolean;
}) {
  return (
    <div>
      <p className="font-sans text-[9px] text-text-dim tracking-[0.14em] uppercase mb-1">
        {label}
      </p>
      <p
        className={`font-mono font-bold text-accent-green leading-none ${
          hero ? "text-[22px] sm:text-[26px]" : "text-[16px] sm:text-[18px]"
        }`}
      >
        {value}
      </p>
    </div>
  );
}
