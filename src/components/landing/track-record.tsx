"use client";

import { useStrategy } from "@/lib/hooks/use-strategy";
import { useChart } from "@/lib/hooks/use-chart";
import { BACKTEST, LIVE_PORTFOLIO, WINNERS_CIRCLE } from "@/lib/constants";
import {
  computeAnnualizedReturn,
  computePortfolioReturnPct,
  countDoubledWinners,
  countWinningPositions,
  daysSinceInception,
  liveAccrualDays,
  formatPct,
} from "@/lib/portfolio";

const backtestMetrics = [
  { label: "CAGR", value: BACKTEST.cagr, green: true, highlight: true },
  { label: "2× WINNERS", value: BACKTEST.winnersCircle.toString(), green: true, highlight: true },
  { label: "WIN RATE", value: BACKTEST.winRate, green: true, highlight: false },
  { label: "S&P 500", value: BACKTEST.spyReturn, green: false, highlight: false },
  { label: "ALPHA", value: BACKTEST.alpha, green: true, highlight: false },
  { label: "TOTAL RETURN", value: BACKTEST.totalReturn, green: true, highlight: false },
];

export function TrackRecord() {
  const { data: strategy } = useStrategy();
  const { data: chart } = useChart();
  const portfolio = strategy?.portfolio;
  const totalReturnPct = computePortfolioReturnPct(strategy);
  const hasReturn = totalReturnPct !== null;
  const days = daysSinceInception();
  const accrualDays = liveAccrualDays(chart?.summary);
  const liveCagr = hasReturn
    ? computeAnnualizedReturn(totalReturnPct!, accrualDays)
    : null;
  const liveDoubled = countDoubledWinners(strategy?.holdings);
  const liveWinners = countWinningPositions(strategy?.holdings);

  return (
    <section id="track-record" className="border-b border-border">
      <div className="container-op py-20">
        <p className="section-label">TRACK RECORD</p>
        <h2 className="section-title">Winners compound. We show both.</h2>
        <p className="section-sub">
          Our edge isn&apos;t one headline return — it&apos;s finding stocks
          that double and letting them run. The model was built and
          walk-forward tested on {BACKTEST.yearsCovered} years of trailing
          market data. We actively trade a live example portfolio to demonstrate
          the process. That is not a recommendation to copy us — we expect you to
          do your own research and build your own portfolio.
        </p>

        {/* Winners highlight strip */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-0.5 bg-border mb-0.5">
          <HighlightStat
            label="MODEL CAGR"
            value={BACKTEST.cagr}
            sub={`${BACKTEST.yearsLabel} · walk-forward`}
          />
          <HighlightStat
            label="PICKS THAT DOUBLED"
            value={BACKTEST.winnersCircle.toString()}
            sub="In the 5-year backtest"
            accent
          />
          <HighlightStat
            label="OUT-OF-SAMPLE ALPHA"
            value={BACKTEST.validationAlpha}
            sub={`${BACKTEST.validationStart} – ${BACKTEST.validationEnd}`}
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-0.5 bg-border mb-0.5">
          {/* Live Portfolio Panel */}
          <div className="bg-bg-secondary">
            <div className="flex items-center justify-between px-7 py-5 border-b border-border">
              <span className="font-mono text-[10px] tracking-[2px] text-text-dim">
                LIVE EXAMPLE PORTFOLIO
              </span>
              <span className="flex items-center gap-2 font-mono text-[9px] tracking-[1.5px] font-bold px-2.5 py-1 bg-accent-green-soft text-accent-green">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent-green opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-accent-green" />
                </span>
                LIVE · NOT ADVICE
              </span>
            </div>

            <div className="px-7 py-6">
              <p className="font-mono text-[11px] text-text-dim mb-5">
                Inception {LIVE_PORTFOLIO.inceptionDate} · Day {days} · We trade
                our own research as a public example
              </p>

              <div className="grid grid-cols-2 gap-0.5 bg-border mb-6">
                <div className="bg-bg-secondary py-5 px-4">
                  <p className="font-mono text-[9px] text-text-dim tracking-[1.5px] mb-1">
                    LIVE CAGR
                  </p>
                  <p
                    className={`font-mono text-[28px] font-bold leading-none ${
                      liveCagr !== null
                        ? liveCagr >= 0
                          ? "text-accent-green"
                          : "text-accent-red"
                        : "text-text"
                    }`}
                  >
                    {liveCagr !== null ? formatPct(liveCagr) : "—"}
                  </p>
                  <p className="font-sans text-[11px] text-text-dim mt-1.5">
                    Annualized from live performance
                  </p>
                </div>
                <div className="bg-bg-secondary py-5 px-4">
                  <p className="font-mono text-[9px] text-text-dim tracking-[1.5px] mb-1">
                    MODEL TARGET CAGR
                  </p>
                  <p className="font-mono text-[28px] font-bold text-accent-green leading-none">
                    {BACKTEST.cagr}
                  </p>
                  <p className="font-sans text-[11px] text-text-dim mt-1.5">
                    5-year walk-forward benchmark
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-0.5 bg-border">
                <LivePanelMetric
                  label="2× WINNERS"
                  value={liveDoubled > 0 ? liveDoubled.toString() : "—"}
                  green={liveDoubled > 0}
                />
                <LivePanelMetric
                  label="WINNING POSITIONS"
                  value={
                    liveWinners > 0 ? liveWinners.toString() : "—"
                  }
                />
                <LivePanelMetric
                  label="TOTAL RETURN"
                  value={hasReturn ? formatPct(totalReturnPct!) : "—"}
                  green={hasReturn ? totalReturnPct! >= 0 : false}
                  red={hasReturn ? totalReturnPct! < 0 : false}
                />
                <LivePanelMetric
                  label="POSITIONS"
                  value={portfolio?.position_count?.toString() ?? "—"}
                />
              </div>

              <p className="font-sans text-[11px] text-text-dim mt-5 leading-relaxed">
                This is our portfolio, published for transparency. It
                demonstrates how we apply the model — not what you should
                buy. CAGR and forecasts will stabilize as the live track record
                grows.
              </p>
            </div>
          </div>

          {/* Backtest Panel */}
          <div className="bg-bg-secondary">
            <div className="flex items-center justify-between px-7 py-5 border-b border-border">
              <span className="font-mono text-[10px] tracking-[2px] text-text-dim">
                5-YEAR MODEL BACKTEST
              </span>
              <span className="font-mono text-[9px] tracking-[1.5px] font-bold px-2.5 py-1 bg-bg-tertiary text-text-muted border border-border">
                SIMULATED · NOT LIVE
              </span>
            </div>

            <div className="px-7 py-6">
              <p className="font-mono text-[11px] text-text-dim mb-5">
                {BACKTEST.startDate} — {BACKTEST.endDate} · Walk-forward on{" "}
                {BACKTEST.yearsCovered} years of history
              </p>

              <div className="grid grid-cols-2 gap-0.5 bg-border mb-6">
                <div className="bg-bg-secondary py-5 px-4">
                  <p className="font-mono text-[9px] text-text-dim tracking-[1.5px] mb-1">
                    CAGR
                  </p>
                  <p className="font-mono text-[28px] font-bold text-accent-green leading-none">
                    {BACKTEST.cagr}
                  </p>
                  <p className="font-sans text-[11px] text-text-dim mt-1.5">
                    vs {BACKTEST.spyReturn} S&amp;P 500
                  </p>
                </div>
                <div className="bg-bg-secondary py-5 px-4">
                  <p className="font-mono text-[9px] text-text-dim tracking-[1.5px] mb-1">
                    2× WINNERS
                  </p>
                  <p className="font-mono text-[28px] font-bold text-accent-green leading-none">
                    {BACKTEST.winnersCircle}
                  </p>
                  <p className="font-sans text-[11px] text-text-dim mt-1.5">
                    Picks that more than doubled
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-0.5 bg-border">
                {backtestMetrics.slice(2).map((m) => (
                  <div key={m.label} className="bg-bg-secondary py-4 px-4">
                    <p className="font-mono text-[9px] text-text-dim tracking-[1.5px] mb-1">
                      {m.label}
                    </p>
                    <p
                      className={`font-mono text-[16px] font-bold ${
                        m.green ? "text-accent-green" : "text-text"
                      }`}
                    >
                      {m.value}
                    </p>
                  </div>
                ))}
              </div>

              <p className="font-sans text-[11px] text-text-dim mt-5 leading-relaxed">
                Point-in-time fundamentals with a 90-day filing lag. Total return
                was {BACKTEST.totalReturn}, but CAGR and winner count are the
                metrics we optimize for. Past simulated performance is{" "}
                <strong className="text-text-muted">not</strong> indicative of
                future results.
              </p>
            </div>
          </div>
        </div>

        {/* How the model portfolio works */}
        <div className="bg-bg-secondary border border-border p-8 mt-0.5">
          <p className="font-mono text-[10px] text-accent-green tracking-[2px] mb-4">
            HOW OUR MODEL PORTFOLIO WORKS
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 font-sans text-[13px] text-text-muted leading-relaxed">
            <div className="space-y-3">
              <p>
                <strong className="text-text">Built on 5 years of history.</strong>{" "}
                We developed the model on trailing market data, then validated it
                walk-forward — training on one period, testing on unseen data
                ({BACKTEST.validationStart} – {BACKTEST.validationEnd}) before
                going live.
              </p>
              <p>
                <strong className="text-text">Biweekly high-conviction picks.</strong>{" "}
                Every two weeks we score ~3,600 US-listed stocks on growth,
                revisions, profitability, momentum, and valuation — then publish
                one name with full research when the framework agrees.
              </p>
            </div>
            <div className="space-y-3">
              <p>
                <strong className="text-text">Winners run, losers get cut.</strong>{" "}
                Position sizing and risk guardrails keep the book disciplined,
                but we don&apos;t cap upside on names that pay back their cost
                basis — that&apos;s how {BACKTEST.winnersCircle} picks doubled in
                the backtest.
              </p>
              <p>
                <strong className="text-text">Live portfolio = example, not instruction.</strong>{" "}
                We trade our own capital and publish every entry, exit, and
                thesis so you can study the process. Use our research to inform
                your decisions — not as a copy-trade signal.
              </p>
            </div>
          </div>

          {/* Top winners preview */}
          <div className="mt-8 pt-6 border-t border-border">
            <p className="font-mono text-[10px] text-text-dim tracking-[2px] mb-4">
              TOP BACKTEST WINNERS · STOCKS THAT DOUBLED
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-0.5 bg-border">
              {WINNERS_CIRCLE.slice(0, 4).map((w, i) => (
                <div key={`${w.ticker}-${i}`} className="bg-bg py-4 px-4">
                  <p className="font-mono text-[14px] font-bold mb-1">{w.ticker}</p>
                  <p className="font-mono text-[16px] font-bold text-accent-green">
                    {w.ret}
                  </p>
                  <p className="font-sans text-[10px] text-text-dim mt-1">
                    {w.entry} → {w.exit}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function HighlightStat({
  label,
  value,
  sub,
  accent = false,
}: {
  label: string;
  value: string;
  sub: string;
  accent?: boolean;
}) {
  return (
    <div className="bg-bg-secondary py-6 px-6 text-center">
      <p className="font-mono text-[9px] text-text-dim tracking-[2px] mb-2">
        {label}
      </p>
      <p
        className={`font-mono text-[32px] font-bold leading-none ${
          accent ? "text-accent-green" : "text-text"
        }`}
      >
        {value}
      </p>
      <p className="font-sans text-[11px] text-text-dim mt-2">{sub}</p>
    </div>
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
