"use client";

import { useMemo } from "react";
import { useStrategy } from "@/lib/hooks/use-strategy";
import { buildPicksComparison, useChart } from "@/lib/hooks/use-chart";
import { DataState, resolveDataState } from "@/components/ui/data-state";
import {
  BenchmarkBasisNote,
  PicksBenchmarkChart,
  PicksBenchmarkLegend,
  formatChartPct,
} from "@/components/ui/picks-benchmark-chart";
import { BACKTEST, WINNERS_CIRCLE } from "@/lib/constants";
import { useInceptionDate } from "@/lib/hooks/use-inception";
import {
  computePortfolioReturnPct,
  countDoubledWinners,
  countWinningPositions,
  describeLiveCagr,
  resolveLiveCagr,
  formatPct,
} from "@/lib/portfolio";

const backtestSecondary = [
  { label: "Win rate", value: BACKTEST.winRate, green: true },
  { label: "S&P 500", value: BACKTEST.spyReturn, green: false },
  { label: "Alpha", value: BACKTEST.alpha, green: true },
  { label: "Total return", value: BACKTEST.totalReturn, green: true },
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
  const cagr = resolveLiveCagr(totalReturnPct, chart?.summary);
  const days = cagr.daysLive;
  const cagrNote = describeLiveCagr(cagr);
  const liveDoubled = countDoubledWinners(strategy?.holdings);
  const liveWinners = countWinningPositions(strategy?.holdings);

  return (
    <section
      id="track-record"
      className="relative border-b border-border overflow-hidden"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-64 bg-[radial-gradient(ellipse_70%_80%_at_50%_-20%,rgba(168,217,160,0.12),transparent_70%)]"
      />

      <div className="container-op relative py-20 sm:py-24">
        <div className="max-w-[680px] mb-12 sm:mb-14">
          <p className="section-label section-label-mint">Track record</p>
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
              Model CAGR
            </p>
            <p className="font-mono text-[40px] sm:text-[48px] font-bold text-accent-green leading-none tracking-tight">
              {BACKTEST.cagr}
            </p>
            <p className="font-sans text-[12px] text-text-dim mt-3">
              {BACKTEST.yearsLabel} · walk-forward validated
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
              {BACKTEST.validationAlpha}
            </p>
            <p className="font-sans text-[11px] text-text-dim mt-2 leading-snug">
              Alpha · {BACKTEST.validationStart} – {BACKTEST.validationEnd}
            </p>
          </div>
        </div>

        {/* Live picks curve vs. the same dollars in each index */}
        <div className="mb-10 sm:mb-12">
          <LivePicksComparison />
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
                <span className="inline-flex items-center gap-2 font-sans text-[9px] tracking-[0.1em] font-bold px-3 py-1 rounded-pill bg-accent-green-soft text-accent-green uppercase">
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

                <div className="grid grid-cols-2 gap-6 sm:gap-8 pb-6 mb-6 border-b border-border">
                  <div>
                    <p className="font-sans text-[10px] font-bold text-text-dim tracking-[0.12em] uppercase mb-1.5">
                      Live CAGR
                    </p>
                    {cagr.value !== null ? (
                      <>
                        <p
                          className={`font-mono text-[32px] sm:text-[36px] font-bold leading-none tracking-tight ${
                            cagr.value >= 0 ? "text-accent-green" : "text-accent-red"
                          }`}
                        >
                          {formatPct(cagr.value)}
                        </p>
                        <p className="font-sans text-[10px] text-text-dim mt-2 leading-snug">
                          Annualized from {cagr.daysLive} days live — an
                          extrapolation, not a realized annual return.
                        </p>
                      </>
                    ) : (
                      <>
                        <p className="font-mono text-[32px] sm:text-[36px] font-bold text-text-dim leading-none tracking-tight">
                          Not yet
                        </p>
                        <p className="font-sans text-[10px] text-text-dim mt-2 leading-snug">
                          {cagrNote}
                        </p>
                      </>
                    )}
                  </div>
                  <div>
                    <p className="font-sans text-[10px] font-bold text-text-dim tracking-[0.12em] uppercase mb-1.5">
                      Model target
                    </p>
                    <p className="font-mono text-[32px] sm:text-[36px] font-bold text-accent-green leading-none tracking-tight">
                      {BACKTEST.cagr}
                    </p>
                  </div>
                </div>

                <dl className="grid grid-cols-2 gap-x-6 gap-y-4">
                  <MetricRow
                    label="2× winners"
                    value={liveDoubled > 0 ? liveDoubled.toString() : "—"}
                    green={liveDoubled > 0}
                  />
                  <MetricRow
                    label="Winning positions"
                    value={liveWinners > 0 ? liveWinners.toString() : "—"}
                  />
                  <MetricRow
                    label="Total return"
                    value={hasReturn ? formatPct(totalReturnPct!) : "—"}
                    green={hasReturn ? totalReturnPct! >= 0 : false}
                    red={hasReturn ? totalReturnPct! < 0 : false}
                  />
                  <MetricRow
                    label="Positions"
                    value={portfolio?.position_count?.toString() ?? "—"}
                  />
                </dl>

                <p className="font-sans text-[11px] text-text-dim mt-6 leading-relaxed border-t border-border pt-5">
                  Our portfolio, published for transparency — not what you
                  should buy. CAGR stabilizes as the live track record grows.
                </p>
              </div>
            </div>
          </div>

          {/* Backtest panel — data sheet */}
          <div className="rounded-soft border border-border overflow-hidden bg-bg-secondary/30">
            <div className="flex flex-wrap items-center justify-between gap-3 px-6 sm:px-7 py-5 border-b border-border">
              <span className="font-sans text-[10px] font-bold tracking-[0.14em] uppercase text-text-dim">
                {BACKTEST.yearsCovered}-year model backtest
              </span>
              <span className="font-sans text-[9px] tracking-[0.1em] font-bold px-3 py-1 rounded-pill bg-bg-tertiary text-text-muted uppercase">
                Simulated · not live
              </span>
            </div>

            <div className="px-6 sm:px-7 py-6 sm:py-7">
              <p className="font-mono text-[11px] text-text-dim mb-6">
                {BACKTEST.startDate} — {BACKTEST.endDate} · {BACKTEST.wins}W /{" "}
                {BACKTEST.losses}L · {BACKTEST.trades} trades
              </p>

              <div className="flex flex-wrap items-end gap-x-10 gap-y-4 pb-6 mb-6 border-b border-border">
                <div>
                  <p className="font-sans text-[10px] font-bold text-text-dim tracking-[0.12em] uppercase mb-1.5">
                    CAGR
                  </p>
                  <p className="font-mono text-[32px] sm:text-[36px] font-bold text-accent-green leading-none">
                    {BACKTEST.cagr}
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

        {/* Explainer + winners strip */}
        <div className="border-t border-border pt-12 sm:pt-14">
          <p className="font-sans text-[11px] font-bold tracking-[0.14em] uppercase text-text mb-6">
            How our model portfolio works
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-6 font-sans text-[13px] text-text-muted leading-relaxed mb-12">
            <p>
              <strong className="text-text">
                Built on {BACKTEST.yearsCovered} years of history.
              </strong>{" "}
              We developed the model on trailing market data, then validated it
              walk-forward — training on one period, testing on unseen data (
              {BACKTEST.validationStart} – {BACKTEST.validationEnd}) before
              going live.
            </p>
            <p>
              <strong className="text-text">Biweekly high-conviction picks.</strong>{" "}
              Every two weeks we score ~3,600 US-listed stocks on growth,
              revisions, profitability, momentum, and valuation — then publish
              one name with full research when the framework agrees.
            </p>
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
              thesis so you can study the process.
            </p>
          </div>

          <div>
            <div className="flex items-end justify-between gap-4 mb-4">
              <p className="font-sans text-[10px] font-bold text-text-dim tracking-[0.12em] uppercase">
                Top backtest winners · stocks that doubled
              </p>
              <span className="font-mono text-[12px] text-text-dim hidden sm:inline">
                {BACKTEST.winnersCircle} total
              </span>
            </div>
            <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1 snap-x snap-mandatory">
              {WINNERS_CIRCLE.slice(0, 4).map((w, i) => (
                <div
                  key={`${w.ticker}-${i}`}
                  className="snap-start shrink-0 min-w-[160px] rounded-soft border border-border bg-bg px-5 py-4"
                >
                  <p className="font-mono text-[15px] font-bold mb-1">{w.ticker}</p>
                  <p className="font-mono text-[18px] font-bold text-accent-green leading-none">
                    {w.ret}
                  </p>
                  <p className="font-sans text-[10px] text-text-dim mt-2 whitespace-nowrap">
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

/**
 * The landing-page version of the picks-vs-benchmarks chart.
 *
 * Deliberately thinner than the dashboard's: one headline number, one legend,
 * one line of basis copy. A visitor should get "the picks beat the same money
 * in the index" in about two seconds without reading anything.
 */
function LivePicksComparison() {
  const { data, isPending, isError, error, refetch } = useChart();
  const comparison = useMemo(() => buildPicksComparison(data), [data]);
  const picksPoints = comparison.rows.filter((r) => r.picks !== null).length;

  const shellClass =
    "rounded-soft border border-border bg-bg overflow-hidden";

  if (isPending) {
    return (
      <div className={`${shellClass} h-[340px] flex items-center justify-center`}>
        <span className="font-sans text-[11px] font-bold tracking-[0.12em] uppercase text-text-dim animate-pulse">
          Loading live chart...
        </span>
      </div>
    );
  }

  if (isError) {
    const state = resolveDataState({
      isPending: false,
      isError: true,
      error,
      isEmpty: false,
    })!;
    return (
      <div className={shellClass}>
        <DataState state={state} error={error} onRetry={() => void refetch()} />
      </div>
    );
  }

  if (picksPoints < 2) {
    return (
      <div className={`${shellClass} px-6 sm:px-7 py-10 text-center`}>
        <p className="font-sans text-[11px] font-bold tracking-[0.12em] uppercase text-text-dim">
          Building track record
        </p>
        <p className="font-sans text-[13px] text-text-muted mt-2">
          The live picks curve appears here once there are two days of marks.
        </p>
      </div>
    );
  }

  const { picksLatestPct, benchmarks, startDate } = comparison;
  const bestBenchmark = benchmarks.reduce<number | null>(
    (acc, b) =>
      b.latestPct === null ? acc : acc === null ? b.latestPct : Math.max(acc, b.latestPct),
    null
  );
  const lead =
    picksLatestPct !== null && bestBenchmark !== null
      ? picksLatestPct - bestBenchmark
      : null;

  return (
    <div className={shellClass}>
      <div className="flex flex-wrap items-center justify-between gap-3 px-6 sm:px-7 py-5 border-b border-border bg-bg-secondary/40">
        <span className="font-sans text-[10px] font-bold tracking-[0.14em] uppercase text-text-dim">
          Live picks vs. the same money in the index
        </span>
        {lead !== null && (
          <span className="font-mono text-[11px] text-text-muted">
            {lead >= 0 ? "Ahead of" : "Behind"} the best benchmark by{" "}
            <span
              className={`font-bold ${lead >= 0 ? "text-accent-green" : "text-accent-red"}`}
            >
              {Math.abs(lead).toFixed(2)} pts
            </span>
          </span>
        )}
      </div>

      <div className="px-4 sm:px-7 py-6 sm:py-7">
        {picksLatestPct !== null && (
          <div className="flex items-end gap-3 mb-5 px-2 sm:px-0">
            <span
              className={`font-mono text-[40px] sm:text-[48px] font-bold leading-none tracking-tight ${
                picksLatestPct >= 0 ? "text-accent-green" : "text-accent-red"
              }`}
            >
              {formatChartPct(picksLatestPct)}
            </span>
            <span className="font-sans text-[12px] text-text-dim pb-1.5">
              on capital deployed into picks
            </span>
          </div>
        )}

        <div className="mb-4 px-2 sm:px-0">
          <PicksBenchmarkLegend comparison={comparison} compact />
        </div>

        <PicksBenchmarkChart comparison={comparison} height={280} compact />

        <div className="mt-5 px-2 sm:px-0">
          {benchmarks.length > 0 ? (
            <BenchmarkBasisNote startDate={startDate} />
          ) : (
            <p className="font-sans text-[11px] text-text-dim leading-relaxed">
              Index comparisons are unavailable right now — we show nothing
              rather than a placeholder line.
            </p>
          )}
        </div>
      </div>
    </div>
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
