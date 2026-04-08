"use client";

import { useStrategy } from "@/lib/hooks/use-strategy";
import { BACKTEST } from "@/lib/constants";
import { computePortfolioReturnPct, formatPct } from "@/lib/portfolio";

const LIVE_INCEPTION = "2026-04-01";

function daysSince(dateStr: string): number {
  const start = new Date(dateStr).getTime();
  const now = Date.now();
  return Math.max(0, Math.floor((now - start) / (1000 * 60 * 60 * 24)));
}

const backtestMetrics = [
  { label: "CAGR", value: BACKTEST.cagr, green: true },
  { label: "S&P 500", value: BACKTEST.spyReturn, green: false },
  { label: "ALPHA", value: BACKTEST.alpha, green: true },
  { label: "SHARPE", value: BACKTEST.sharpe, green: false },
  { label: "MAX DRAWDOWN", value: BACKTEST.maxDrawdown, green: false },
  { label: "WIN RATE", value: BACKTEST.winRate, green: false },
];

export function TrackRecord() {
  const { data: strategy } = useStrategy();
  const portfolio = strategy?.portfolio;
  const totalReturnPct = computePortfolioReturnPct(strategy);
  const hasReturn = totalReturnPct !== null;
  const days = daysSince(LIVE_INCEPTION);

  return (
    <section id="track-record" className="border-b border-border">
      <div className="container-op py-20">
        <p className="section-label">TRACK RECORD</p>
        <h2 className="section-title">Two data sources. Full transparency.</h2>
        <p className="section-sub">
          A live portfolio, started this month, and a walk-forward backtest
          covering Jun 2022 — Apr 2026 that proves the model. We show both —
          clearly labeled — so you can judge for yourself.
        </p>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-0.5 bg-border">
          {/* Live Portfolio Panel */}
          <div className="bg-bg-secondary">
            <div className="flex items-center justify-between px-7 py-5 border-b border-border">
              <span className="font-mono text-[10px] tracking-[2px] text-text-dim">
                LIVE PORTFOLIO
              </span>
              <span className="flex items-center gap-2 font-mono text-[9px] tracking-[1.5px] font-bold px-2.5 py-1 bg-accent-green-soft text-accent-green">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent-green opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-accent-green" />
                </span>
                LIVE
              </span>
            </div>

            <div className="px-7 py-6">
              <p className="font-mono text-[11px] text-text-dim mb-5">
                Inception Apr 01, 2026 · Real trades · No cherry-picking
              </p>

              <div className="mb-6">
                <p
                  className={`font-mono text-[42px] font-bold leading-none ${
                    hasReturn
                      ? totalReturnPct! >= 0
                        ? "text-accent-green"
                        : "text-accent-red"
                      : "text-text"
                  }`}
                >
                  {hasReturn ? formatPct(totalReturnPct!) : `Day ${days}`}
                </p>
                <p className="font-sans text-[13px] text-text-muted mt-1.5">
                  {hasReturn
                    ? `Total return · Day ${days} of live tracking`
                    : "Track record building in real time"}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-0.5 bg-border">
                <LivePanelMetric
                  label="POSITIONS"
                  value={portfolio?.position_count?.toString() ?? "—"}
                />
                <LivePanelMetric
                  label="DAYS LIVE"
                  value={days.toString()}
                />
                <LivePanelMetric
                  label="EVALUATION"
                  value="Biweekly"
                />
                <LivePanelMetric
                  label="AGENTS"
                  value="6"
                />
              </div>

              <p className="font-sans text-[11px] text-text-dim mt-5 leading-relaxed">
                Members see every entry, exit, and reasoning as it happens.
                Live performance will compound over time — we&apos;re showing it
                from day one, with nothing hidden.
              </p>
            </div>
          </div>

          {/* Backtest Panel */}
          <div className="bg-bg-secondary">
            <div className="flex items-center justify-between px-7 py-5 border-b border-border">
              <span className="font-mono text-[10px] tracking-[2px] text-text-dim">
                STRATEGY BACKTEST
              </span>
              <span className="font-mono text-[9px] tracking-[1.5px] font-bold px-2.5 py-1 bg-bg-tertiary text-text-muted border border-border">
                SIMULATED · NOT LIVE
              </span>
            </div>

            <div className="px-7 py-6">
              <p className="font-mono text-[11px] text-text-dim mb-5">
                {BACKTEST.startDate} — {BACKTEST.endDate} ·{" "}
                {BACKTEST.yearsCovered}-year walk-forward
              </p>

              <div className="mb-6">
                <p className="font-mono text-[42px] font-bold text-accent-green leading-none">
                  {BACKTEST.totalReturn}
                </p>
                <p className="font-sans text-[13px] text-text-muted mt-1.5">
                  Total return vs {BACKTEST.spyReturn} S&amp;P 500 (simulation)
                </p>
              </div>

              <div className="grid grid-cols-2 gap-0.5 bg-border">
                {backtestMetrics.map((m) => (
                  <div key={m.label} className="bg-bg-secondary py-4 px-4">
                    <p className="font-mono text-[9px] text-text-dim tracking-[1.5px] mb-1">
                      {m.label}
                    </p>
                    <p
                      className={`font-mono text-[18px] font-bold ${
                        m.green ? "text-accent-green" : "text-text"
                      }`}
                    >
                      {m.value}
                    </p>
                  </div>
                ))}
              </div>

              <p className="font-sans text-[11px] text-text-dim mt-5 leading-relaxed">
                Walk-forward simulation using point-in-time fundamentals + a
                90-day filing lag. Past simulated performance is{" "}
                <strong className="text-text-muted">not</strong> indicative of
                future results.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function LivePanelMetric({
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
    <div className="bg-bg-secondary py-4 px-4">
      <p className="font-mono text-[9px] text-text-dim tracking-[1.5px] mb-1">
        {label}
      </p>
      <p
        className={`font-mono text-[16px] font-bold ${
          red ? "text-accent-red" : green ? "text-accent-green" : "text-text"
        }`}
      >
        {value}
      </p>
    </div>
  );
}
