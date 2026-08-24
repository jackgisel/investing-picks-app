"use client";

import { useStrategy } from "@/lib/hooks/use-strategy";
import { useChart } from "@/lib/hooks/use-chart";
import { BACKTEST, WINNERS_CIRCLE, WINNERS_CIRCLE_EXITS } from "@/lib/constants";
import { BacktestHoldings } from "./backtest-holdings";
import { useInceptionDate } from "@/lib/hooks/use-inception";
import {
  computePortfolioReturnPct,
  countDoubledWinners,
  countWinningPositions,
  resolveLiveCagr,
  formatPct,
  PUBLIC_CAGR_MIN_DAYS,
} from "@/lib/portfolio";
import { CompanyLogo } from "@/components/ui/company-logo";
import { HScroll } from "@/components/ui/h-scroll";

const backtestSecondary = [
  { label: "Win rate", value: BACKTEST.winRate, green: true },
  { label: "S&P 500", value: BACKTEST.spyReturn, green: false },
  { label: "Outpicked S&P", value: BACKTEST.outpickedSp, green: true },
  { label: "Sharpe", value: BACKTEST.sharpe, green: false },
  { label: "Max drawdown", value: BACKTEST.maxDrawdown, green: false },
];

/** "2026-04-01" → "Apr 01, 2026". UTC so the label never slips a day. */
function formatInceptionDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function TrackRecord() {
  const { data: strategy } = useStrategy();
  const { data: chart } = useChart();
  const { inceptionISO } = useInceptionDate();
  const portfolio = strategy?.portfolio;
  const totalReturnPct = computePortfolioReturnPct(strategy);
  const hasReturn = totalReturnPct !== null;
  // One elapsed-time notion for both the "Day N" badge and the CAGR window, so
  // the card cannot claim a long track record beside a one-day annualization.
  // "picks" to match `totalReturnPct` above, which is the picks return.
  const cagr = resolveLiveCagr(totalReturnPct, chart?.summary, "picks");
  const days = cagr.daysLive;
  const liveDoubled = countDoubledWinners(strategy?.holdings);
  const liveWinners = countWinningPositions(strategy?.holdings);

  return (
    <section
      id="track-record"
      className="relative border-b border-border overflow-hidden"
    >
      <div className="container-op relative py-20 sm:py-24">
        <div className="max-w-[680px] mb-12 sm:mb-14">
          <p className="section-label">Track record</p>
          <h2 className="section-title">Winners compound. We show both.</h2>
          <p className="section-sub mb-0">
            Our edge isn&apos;t one headline return — it&apos;s finding stocks
            that double and letting them run. The model was built and
            walk-forward tested on {BACKTEST.yearsCovered} years of trailing
            market data. We actively trade a live example portfolio to
            demonstrate the process. That is not a recommendation to copy us —
            we expect you to do your own research and build your own portfolio.
          </p>
        </div>

        {/* Asymmetric hero metrics */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 mb-10 sm:mb-12">
          <div className="md:col-span-5 rounded-soft border border-border bg-bg px-7 py-8 sm:px-8">
            <p className="font-sans text-[10px] font-bold text-text-dim tracking-[0.14em] uppercase mb-2">
              Total return
            </p>
            <p className="font-mono text-[40px] sm:text-[48px] font-bold text-accent-green leading-none tracking-tight">
              {BACKTEST.totalReturn}
            </p>
            <p className="font-sans text-[12px] text-text-dim mt-3">
              {BACKTEST.yearsLabel} · walk-forward validated · backtrained model
            </p>
          </div>

          <div className="md:col-span-4 rounded-soft bg-accent-green-soft/50 border border-accent-green/20 px-7 py-8 sm:px-8 flex flex-col justify-center">
            <p className="font-sans text-[10px] font-bold text-text-dim tracking-[0.14em] uppercase mb-2">
              Picks that doubled
            </p>
            <p className="font-mono text-[36px] sm:text-[42px] font-bold text-accent-green leading-none">
              {BACKTEST.winnersCircle}
            </p>
            <p className="font-sans text-[12px] text-text-muted mt-3">
              In the {BACKTEST.yearsCovered}-year backtest
            </p>
          </div>

          <div className="md:col-span-3 rounded-soft border border-dashed border-border px-6 py-8 flex flex-col justify-center">
            <p className="font-sans text-[10px] font-bold text-text-dim tracking-[0.14em] uppercase mb-2">
              Out-of-sample
            </p>
            <p className="font-mono text-[28px] sm:text-[32px] font-bold text-text leading-none">
              {BACKTEST.validationOutpickedSp}
            </p>
            <p className="font-sans text-[11px] text-text-dim mt-2 leading-snug">
              Outpicked S&amp;P · {BACKTEST.validationStart} – {BACKTEST.validationEnd}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-10 mb-12">
          {/* Live panel — editorial ledger */}
          <div className="relative rounded-soft border border-border overflow-hidden bg-bg">
            <div className="absolute inset-y-0 left-0 w-1 bg-accent-green" />
            <div className="pl-1">
              <div className="flex flex-wrap items-center justify-between gap-3 px-6 sm:px-7 py-5 border-b border-border bg-bg-secondary/40">
                <span className="font-sans text-[10px] font-bold tracking-[0.14em] uppercase text-text-dim">
                  Live example portfolio
                </span>
                <span className="badge !text-[9px] text-accent-green bg-accent-green-soft">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent-green opacity-60" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-accent-green" />
                  </span>
                  Live · not advice
                </span>
              </div>

              <div className="px-6 sm:px-7 py-6 sm:py-7">
                <p className="font-mono text-[11px] text-text-dim mb-6">
                  Inception {formatInceptionDate(inceptionISO)} · Day {days}
                </p>

                <div className="pb-6 mb-6 border-b border-border">
                  <p className="font-sans text-[10px] font-bold text-text-dim tracking-[0.12em] uppercase mb-1.5">
                    Live return
                  </p>
                  <p
                    className={`font-mono text-[32px] sm:text-[36px] font-bold leading-none tracking-tight ${
                      hasReturn && totalReturnPct! >= 0
                        ? "text-accent-green"
                        : hasReturn
                          ? "text-accent-red"
                          : "text-text-dim"
                    }`}
                  >
                    {hasReturn ? formatPct(totalReturnPct!) : "—"}
                  </p>
                  <p className="font-sans text-[10px] text-text-dim mt-2 leading-snug">
                    On capital deployed into picks — cash held back to fund
                    future buys isn&apos;t counted.
                  </p>
                  {cagr.value !== null && cagr.daysLive >= PUBLIC_CAGR_MIN_DAYS && (
                    <p className="font-mono text-[13px] text-text-muted mt-3">
                      {formatPct(cagr.value)}{" "}
                      <span className="font-sans text-[10px] font-bold uppercase tracking-[0.1em] text-text-dim">
                        annualized
                      </span>
                    </p>
                  )}
                </div>

                <dl className="grid grid-cols-2 gap-x-6 gap-y-4">
                  <MetricRow
                    label="2× winners"
                    value={liveDoubled > 0 ? liveDoubled.toString() : "—"}
                    green={liveDoubled > 0}
                  />
                  <MetricRow
                    label="Winning picks"
                    value={liveWinners > 0 ? liveWinners.toString() : "—"}
                  />
                  <MetricRow
                    label="Open picks"
                    value={portfolio?.position_count?.toString() ?? "—"}
                  />
                </dl>

                <p className="font-sans text-[11px] text-text-dim mt-6 leading-relaxed border-t border-border pt-5">
                  Our portfolio, published for transparency — not what you
                  should buy. Trades are logged manually with real fill
                  prices and dates, not auto-synced from a brokerage feed.
                  Position sizes are illustrative, so every return here comes
                  from price movement, not dollar size.
                </p>
              </div>
            </div>
          </div>

          {/* Backtest panel — data sheet */}
          <div className="rounded-soft border border-border overflow-hidden bg-bg-secondary/30">
            <div className="flex flex-wrap items-center justify-between gap-3 px-6 sm:px-7 py-5 border-b border-border">
              <span className="font-sans text-[10px] font-bold tracking-[0.14em] uppercase text-text-dim">
                {BACKTEST.yearsCovered}-year backtrained model
              </span>
              <span className="badge !text-[9px] text-text-muted bg-bg-tertiary">
                Simulated · not live
              </span>
            </div>

            <div className="px-6 sm:px-7 py-6 sm:py-7">
              <p className="font-mono text-[11px] text-text-dim mb-6">
                {BACKTEST.startDate} — {BACKTEST.endDate} · {BACKTEST.wins}W/
                {BACKTEST.losses}L of {BACKTEST.closedPicks} closed picks ·{" "}
                {BACKTEST.trades} trades
              </p>

              <div className="flex flex-wrap items-end gap-x-10 gap-y-4 pb-6 mb-6 border-b border-border">
                <div>
                  <p className="font-sans text-[10px] font-bold text-text-dim tracking-[0.12em] uppercase mb-1.5">
                    Total return
                  </p>
                  <p className="font-mono text-[32px] sm:text-[36px] font-bold text-accent-green leading-none">
                    {BACKTEST.totalReturn}
                  </p>
                  <p className="font-sans text-[11px] text-text-dim mt-2">
                    vs {BACKTEST.spyReturn} S&amp;P 500
                  </p>
                </div>
                <div>
                  <p className="font-sans text-[10px] font-bold text-text-dim tracking-[0.12em] uppercase mb-1.5">
                    2× winners
                  </p>
                  <p className="font-mono text-[32px] sm:text-[36px] font-bold text-accent-green leading-none">
                    {BACKTEST.winnersCircle}
                  </p>
                </div>
              </div>

              <div className="divide-y divide-border">
                {backtestSecondary.map((m) => (
                  <div
                    key={m.label}
                    className="flex items-center justify-between py-3 first:pt-0 last:pb-0"
                  >
                    <span className="font-sans text-[12px] text-text-muted">
                      {m.label}
                    </span>
                    <span
                      className={`font-mono text-[14px] font-bold ${
                        m.green ? "text-accent-green" : "text-text"
                      }`}
                    >
                      {m.value}
                    </span>
                  </div>
                ))}
              </div>

              <p className="font-sans text-[11px] text-text-dim mt-6 leading-relaxed border-t border-border pt-5">
                Point-in-time fundamentals with a 90-day filing lag. Past
                simulated performance is{" "}
                <strong className="text-text-muted">not</strong> indicative of
                future results.
              </p>
            </div>
          </div>
        </div>

        {/* Final holdings, moved here off the homepage. This is the deep proof
            page, which is where a table of simulated positions belongs. */}
        <div className="border-t border-border pt-12 sm:pt-14">
          <p className="font-sans text-[11px] font-bold tracking-[0.14em] uppercase text-text mb-6">
            Every name the model ended holding
          </p>
          <BacktestHoldings />
        </div>

        {/* Explainer + winners strip */}
        <div className="border-t border-border pt-12 sm:pt-14 mt-12 sm:mt-14">
          <p className="font-sans text-[11px] font-bold tracking-[0.14em] uppercase text-text mb-6">
            How the backtrained model and live example portfolio work
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-6 font-sans text-[13px] text-text-muted leading-relaxed mb-12">
            <p>
              <strong className="text-text">Backtrained on {BACKTEST.yearsCovered} years of history.</strong>{" "}
              We built the model on trailing market data, then validated it
              walk-forward — training on one period, testing on unseen data (
              {BACKTEST.validationStart} – {BACKTEST.validationEnd}) before
              going live. This is simulated performance, not a track record —
              see the badge above.
            </p>
            <p>
              <strong className="text-text">Winners run, losers get cut.</strong>{" "}
              Position sizing and risk guardrails keep the book disciplined,
              but we don&apos;t cap upside on names that pay back their cost
              basis. In the backtrained model {BACKTEST.winnersCircle}{" "}
              positions doubled, and we sold out of them across{" "}
              {WINNERS_CIRCLE_EXITS} separate exits — trimming as they ran
              rather than closing all at once.
            </p>
            <p>
              <strong className="text-text">Live example portfolio, not instruction.</strong>{" "}
              We place real trades on our own capital, marked at each day&apos;s
              closing price, and publish every entry and exit. We&apos;re not
              chasing the perfect entry or exit — our research is about
              finding valuable businesses and cost-basis averaging into them
              over a long horizon. Position sizes shown are illustrative, so
              nothing here implies a fixed account size.
            </p>
          </div>

          <div>
            <div className="flex items-end justify-between gap-4 mb-4">
              <p className="font-sans text-[10px] font-bold text-text-dim tracking-[0.12em] uppercase">
                Backtrained model winners · picks that doubled
              </p>
              <span className="font-mono text-[12px] text-text-dim hidden sm:inline">
                {BACKTEST.winnersCircle} total
              </span>
            </div>
            <HScroll
              className="-mx-1"
              innerClassName="flex gap-3 px-1 pb-2 snap-x snap-mandatory"
            >
              {WINNERS_CIRCLE.slice(0, 4).map((w, i) => (
                <div
                  key={`${w.ticker}-${i}`}
                  className="w-[72%] max-w-[220px] shrink-0 snap-start rounded-soft border border-border bg-bg px-5 py-4"
                >
                  <div className="mb-3 flex items-center gap-2.5">
                    <CompanyLogo ticker={w.ticker} size="sm" />
                    <p className="font-mono text-[15px] font-bold">{w.ticker}</p>
                  </div>
                  <p className="font-mono text-[18px] font-bold text-accent-green leading-none">
                    {w.ret}
                  </p>
                  <p className="font-sans text-[10px] text-text-dim mt-2 whitespace-nowrap">
                    {w.entry} → {w.exit}
                  </p>
                </div>
              ))}
            </HScroll>
            <p className="font-sans text-[11px] text-text-dim mt-4 leading-relaxed max-w-[560px]">
              Concentrated by design, not diversified: four of these five
              doubles came from a single macro theme (Argentine equities,
              2023–2025). A repeat requires a comparable dislocation, not a
              repeatable process across unrelated names.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

function MetricRow({
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
    <div className="flex items-baseline justify-between gap-3 border-b border-border/60 pb-3">
      <dt className="font-sans text-[11px] text-text-dim">{label}</dt>
      <dd
        className={`font-mono text-[15px] font-bold ${
          red ? "text-accent-red" : green ? "text-accent-green" : "text-text"
        }`}
      >
        {value}
      </dd>
    </div>
  );
}
