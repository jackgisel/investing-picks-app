import { BACKTEST, LIVE_PORTFOLIO } from "@/lib/constants";

const backtestMetrics = [
  { label: "TOTAL RETURN", value: BACKTEST.totalReturn, green: true },
  { label: "CAGR", value: BACKTEST.cagr, green: true },
  { label: "S&P 500", value: BACKTEST.spyReturn, green: false },
  { label: "ALPHA", value: BACKTEST.alpha, green: true },
  { label: "SHARPE", value: BACKTEST.sharpe, green: false },
  { label: "MAX DRAWDOWN", value: BACKTEST.maxDrawdown, green: false },
  { label: "WIN RATE", value: `${BACKTEST.winRate}`, green: false },
  { label: "TRADES", value: `${BACKTEST.trades}`, green: false },
];

export function TrackRecord() {
  return (
    <section id="track-record" className="border-b border-border">
      <div className="container-op py-20">
        <p className="section-label">TRACK RECORD</p>
        <h2 className="section-title">Two data sources. Full transparency.</h2>
        <p className="section-sub">
          A 7-year walk-forward backtest to prove the model, and a live portfolio
          to prove it&apos;s real. Both fully visible to members.
        </p>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-0.5 bg-border">
          {/* Backtest Panel */}
          <div className="bg-bg-secondary">
            <div className="flex items-center justify-between px-7 py-5 border-b border-border">
              <div className="flex items-center gap-3">
                <span className="font-mono text-[10px] tracking-[2px] text-text-dim">
                  7-YEAR BACKTEST
                </span>
              </div>
              <span className="font-mono text-[9px] tracking-[1.5px] font-bold px-2.5 py-1 bg-accent-purple-soft text-accent-purple">
                SIMULATED
              </span>
            </div>

            <div className="px-7 py-6">
              <p className="font-mono text-[11px] text-text-dim mb-5">
                {BACKTEST.startDate} — {BACKTEST.endDate} &middot;{" "}
                {BACKTEST.startingCapital} starting capital
              </p>

              {/* Big number */}
              <div className="mb-6">
                <p className="font-mono text-[42px] font-bold text-accent-green leading-none">
                  {BACKTEST.totalReturn}
                </p>
                <p className="font-sans text-[13px] text-text-muted mt-1.5">
                  {BACKTEST.startingCapital} → {BACKTEST.finalValue}
                </p>
              </div>

              {/* Metric grid */}
              <div className="grid grid-cols-2 gap-0.5 bg-border">
                {backtestMetrics.slice(1).map((m) => (
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
                {/* Fill the last cell */}
                <div className="bg-bg-secondary py-4 px-4">
                  <p className="font-mono text-[9px] text-text-dim tracking-[1.5px] mb-1">
                    WINNERS CIRCLE
                  </p>
                  <p className="font-mono text-[18px] font-bold text-accent-green">
                    {BACKTEST.winnersCircle}
                  </p>
                </div>
              </div>

              <p className="font-sans text-[11px] text-text-dim mt-5 leading-relaxed">
                Walk-forward simulation using point-in-time annual fundamentals
                + historical prices. 90-day filing lag applied.
              </p>
            </div>
          </div>

          {/* Live Portfolio Panel */}
          <div className="bg-bg-secondary">
            <div className="flex items-center justify-between px-7 py-5 border-b border-border">
              <div className="flex items-center gap-3">
                <span className="font-mono text-[10px] tracking-[2px] text-text-dim">
                  LIVE PORTFOLIO
                </span>
              </div>
              <span className="flex items-center gap-2 font-mono text-[9px] tracking-[1.5px] font-bold px-2.5 py-1 bg-accent-green-soft text-accent-green">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent-green opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-accent-green" />
                </span>
                {LIVE_PORTFOLIO.status}
              </span>
            </div>

            <div className="px-7 py-6">
              <p className="font-mono text-[11px] text-text-dim mb-5">
                Inception {LIVE_PORTFOLIO.inceptionDate} &middot; Real money
                &middot; Real trades
              </p>

              {/* Live status */}
              <div className="mb-6">
                <p className="font-mono text-[42px] font-bold text-text leading-none">
                  Day 5
                </p>
                <p className="font-sans text-[13px] text-text-muted mt-1.5">
                  Active since {LIVE_PORTFOLIO.inceptionDate}
                </p>
              </div>

              {/* What members get */}
              <div className="space-y-0.5">
                {[
                  {
                    label: "STRATEGY",
                    value: "Same model, real capital",
                    desc: "The exact strategy from the backtest, now running live with real money on the line.",
                  },
                  {
                    label: "TRANSPARENCY",
                    value: "Every trade visible",
                    desc: "Members see every entry, exit, and position size as it happens. No cherry-picking.",
                  },
                  {
                    label: "FREQUENCY",
                    value: "New pick every 2 weeks",
                    desc: "Bi-weekly high-conviction picks with full research notes and thesis.",
                  },
                  {
                    label: "TRACKING",
                    value: "Benchmarked vs S&P 500",
                    desc: "Performance measured honestly against the index, updated in real time.",
                  },
                ].map((item) => (
                  <div key={item.label} className="bg-bg py-4 px-4">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-mono text-[9px] text-accent-green tracking-[1.5px]">
                        {item.label}
                      </span>
                    </div>
                    <p className="font-sans text-[14px] font-semibold mb-0.5">
                      {item.value}
                    </p>
                    <p className="font-sans text-[12px] text-text-muted leading-relaxed">
                      {item.desc}
                    </p>
                  </div>
                ))}
              </div>

              <p className="font-sans text-[11px] text-text-dim mt-5 leading-relaxed">
                Live portfolio results will build over time. Past backtest
                performance is not indicative of future results.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
