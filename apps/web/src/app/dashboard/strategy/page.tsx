"use client";

import { useStrategy } from "@/lib/hooks/use-strategy";
import {
  DataStateCard,
  hasDataState,
  resolveDataState,
} from "@/components/ui/data-state";
import {
  FactorCard,
  PickFunnel,
  PositionLifecycle,
  SectorRelativeExample,
  type Emphasis,
} from "@/components/dashboard/strategy-diagrams";
import { sectorPositionCap } from "@/components/dashboard/sector-model";
import { BACKTEST, WINNERS_CIRCLE_EXITS } from "@/lib/constants";
import { Check, X } from "lucide-react";

/**
 * What the model looks at, and what it does with a position afterwards.
 *
 * This page used to be six lines of jargon over a `JSON.stringify` of the
 * entire parameter set — which was both unreadable and a full disclosure of
 * the research: every factor weight and rating threshold, on screen. The API
 * no longer serves those (see StrategyParams.PUBLIC_FIELDS), and the page now
 * explains the method instead of dumping it.
 *
 * The line held throughout: describe *what is measured and why* in as much
 * detail as we can, and never the *weighting or thresholds* that would let
 * someone reproduce a pick.
 */

const FACTORS: {
  name: string;
  question: string;
  measures: string[];
  emphasis: Emphasis;
}[] = [
  {
    name: "Growth",
    question:
      "Is the business genuinely getting bigger, and is it accelerating or merely continuing? We read growth on a trailing twelve-month basis so a single strong quarter cannot carry a name.",
    measures: ["Revenue TTM", "Earnings TTM", "Quarterly trend"],
    emphasis: "primary",
  },
  {
    name: "Revisions",
    question:
      "Are the analysts who cover this company revising their forecasts up or down? Estimate direction tends to lead price, so a business being marked up by the people closest to it is the single most forward-looking input we have.",
    measures: ["Consensus EPS drift", "Revenue estimate drift"],
    emphasis: "primary",
  },
  {
    name: "Profitability",
    question:
      "Does growth actually convert into money? Margins and returns on capital separate a business compounding real earnings from one buying revenue at a loss.",
    measures: ["Gross margin", "Operating margin", "Return on equity"],
    emphasis: "supporting",
  },
  {
    name: "Momentum",
    question:
      "Has the market already begun to agree? Measured over a full year rather than weeks — we are looking for a durable re-rating, not a bounce, and names that have run too far too fast are penalised rather than rewarded.",
    measures: ["12-month return", "Drawdown from peak"],
    emphasis: "supporting",
  },
  {
    name: "Valuation",
    question:
      "What are we paying for all of the above? Deliberately the lightest input: cheap businesses are usually cheap for a reason, and this acts as a brake on overpaying rather than as a reason to buy.",
    measures: ["P/E", "EV/EBITDA", "PEG", "Price/sales"],
    emphasis: "light",
  },
];

const DISCIPLINE = [
  {
    do: true,
    text: "Publish every pick, including the ones that lose money",
  },
  {
    do: true,
    text: "Decide exit rules before entry, not after a position moves",
  },
  { do: true, text: "Size every position equally at entry" },
  { do: false, text: "Use leverage, options, or short positions" },
  { do: false, text: "Trade on news, rumour, or anything we cannot measure" },
  { do: false, text: "Change the model because a pick went against us" },
];

function num(v: unknown): number | null {
  return typeof v === "number" ? v : null;
}

export default function StrategyPage() {
  const { data, isPending, isError, error, refetch } = useStrategy();

  const state = resolveDataState({
    isPending,
    isError,
    error,
    isEmpty: !data,
  });

  const params = data?.params ?? {};
  const cadence =
    data?.evaluation_frequency ?? data?.strategy?.evaluation_frequency ?? "—";
  const maxPositions = data?.max_positions ?? data?.strategy?.max_positions;
  const sectorCap = num(params.sector_concentration);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="page-title">Strategy</h1>
        <p className="mt-1 max-w-[620px] font-sans text-[13px] leading-relaxed text-text-dim">
          Five factors, scored against a company&apos;s own sector, re-run from
          scratch every cycle. Below is what each one measures and what happens
          to a position once we own it.
        </p>
      </div>

      {hasDataState(state) ? (
        <DataStateCard
          state={state}
          error={error}
          onRetry={() => refetch()}
          emptyTitle="No strategy published yet"
          emptyMessage="Parameters appear once the engine has run an evaluation."
        />
      ) : (
        <>
          {/* The backtrained model data sheet — the number that sold the
              subscription lives inside the product, not just on the
              marketing site. Simulated; never blended with live figures. */}
          <section className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="panel-label panel-label-yellow">
                The backtrained model
              </p>
              <span className="badge bg-bg-tertiary text-text-muted">
                Simulated
              </span>
            </div>
            <div className="data-card">
              <p className="font-mono text-[12px] text-text-dim mb-5">
                {BACKTEST.startDate} — {BACKTEST.endDate} ·{" "}
                {BACKTEST.yearsCovered} years · walk-forward validated
              </p>
              <div className="grid grid-cols-2 gap-x-8 gap-y-5 sm:grid-cols-4">
                <div>
                  <p className="field-label">TOTAL RETURN</p>
                  <p className="mt-1.5 font-mono text-xl font-bold tabular-nums text-accent-green">
                    {BACKTEST.totalReturn}
                  </p>
                  <p className="mt-1 font-sans text-[11px] text-text-dim">
                    vs {BACKTEST.spyReturn} S&amp;P 500
                  </p>
                </div>
                <div>
                  <p className="field-label">SHARPE</p>
                  <p className="mt-1.5 font-mono text-xl font-bold tabular-nums text-text">
                    {BACKTEST.sharpe}
                  </p>
                </div>
                <div>
                  <p className="field-label">MAX DRAWDOWN</p>
                  <p className="mt-1.5 font-mono text-xl font-bold tabular-nums text-text">
                    {BACKTEST.maxDrawdown}
                  </p>
                  <p className="mt-1 font-sans text-[11px] text-text-dim">
                    {BACKTEST.maxDrawdownDate}
                  </p>
                </div>
                <div>
                  <p className="field-label">WIN RATE</p>
                  <p className="mt-1.5 font-mono text-xl font-bold tabular-nums text-text">
                    {BACKTEST.winRate}
                  </p>
                  <p className="mt-1 font-sans text-[11px] text-text-dim">
                    {BACKTEST.wins}W/{BACKTEST.losses}L of{" "}
                    {BACKTEST.closedPicks} closed picks
                  </p>
                </div>
              </div>
              <div className="mt-5 border-t border-border pt-4 flex flex-wrap items-center gap-x-8 gap-y-3">
                <div>
                  <p className="field-label">OUT-OF-SAMPLE WINDOW</p>
                  <p className="mt-1.5 font-mono text-[13px] font-semibold text-text">
                    {BACKTEST.validationStart} – {BACKTEST.validationEnd}
                  </p>
                </div>
                <div>
                  <p className="field-label">OUT-OF-SAMPLE EXCESS RETURN</p>
                  <p className="mt-1.5 font-mono text-[13px] font-semibold text-accent-green">
                    {BACKTEST.validationOutpickedSp}
                  </p>
                </div>
                <div>
                  <p className="field-label">DOUBLED POSITIONS</p>
                  <p className="mt-1.5 font-mono text-[13px] font-semibold text-text">
                    {BACKTEST.winnersCircle}{" "}
                    <span className="text-text-dim font-sans font-normal">
                      ({WINNERS_CIRCLE_EXITS} exits — trimmed, not sold at once)
                    </span>
                  </p>
                </div>
              </div>
              <p className="mt-5 font-sans text-[12px] leading-relaxed text-text-dim border-t border-border pt-4">
                Point-in-time fundamentals with a 90-day filing lag. Trained on{" "}
                {BACKTEST.startDate} – {BACKTEST.validationStart}, tested only
                on the unseen {BACKTEST.validationStart} –{" "}
                {BACKTEST.validationEnd} window before any capital followed
                it. Simulated performance — not a realized track record, and
                not indicative of future results.
              </p>
            </div>
          </section>

          {/* What we measure */}
          <section className="space-y-3">
            <p className="panel-label">
              What we score, and why
            </p>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {FACTORS.map((f) => (
                <FactorCard key={f.name} {...f} />
              ))}
              <div id="quant-rating" className="data-card flex flex-col justify-center bg-transparent scroll-mt-24">
                <p className="font-sans text-[13px] leading-relaxed text-text-muted">
                  The five are combined into a single{" "}
                  <span className="font-semibold text-text">1–5 rating</span>{" "}
                  per company, refreshed every cycle. How they are weighted
                  against each other is the part we keep — but the emphasis
                  tiers above are honest about which ones move the number most.
                </p>
                <p className="mt-3 font-sans text-[12px] leading-relaxed text-text-dim">
                  A name missing data on any factor is disqualified outright
                  rather than scored on what happens to be available.
                </p>
              </div>
            </div>
          </section>

          {/* The differentiator */}
          <section className="space-y-3">
            <p className="panel-label">
              Everything is judged against its own sector
            </p>
            <SectorRelativeExample />
          </section>

          {/* How a pick is chosen */}
          <section className="space-y-3">
            <p className="panel-label">How a pick is chosen</p>
            <PickFunnel />
          </section>

          {/* What happens after */}
          <section className="space-y-3">
            <p className="panel-label">
              What happens once we own it
            </p>
            <PositionLifecycle
              winnerThresholdPct={
                num(params.winner_threshold) !== null
                  ? num(params.winner_threshold)! * 100
                  : null
              }
              underwaterDays={num(params.max_underwater_days)}
              capPct={
                num(params.position_cap_normal) !== null
                  ? num(params.position_cap_normal)! * 100
                  : null
              }
              trimToPct={
                num(params.position_trim_target) !== null
                  ? num(params.position_trim_target)! * 100
                  : null
              }
            />
          </section>

          {/* Risk contract */}
          <section className="space-y-3">
            <p className="panel-label">The risk contract</p>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="data-card">
                <p className="field-label">SECTOR CEILING</p>
                <p className="mt-1.5 font-mono text-xl font-bold tabular-nums text-text">
                  {sectorPositionCap(sectorCap, maxPositions) ?? "—"}
                  <span className="font-sans text-[13px] font-medium text-text-dim">
                    {" "}
                    names
                  </span>
                </p>
                <p className="mt-2 font-sans text-[12px] leading-relaxed text-text-dim">
                  The most positions we will hold in any one sector. Checked on
                  every buy, not reviewed after the fact.
                </p>
              </div>
              <div className="data-card">
                <p className="field-label">NEW PICKS PER CYCLE</p>
                <p className="mt-1.5 font-mono text-xl font-bold tabular-nums text-text">
                  {num(params.max_adds_per_evaluation) ?? "—"}
                </p>
                <p className="mt-2 font-sans text-[12px] leading-relaxed text-text-dim">
                  Exactly one, {cadence}. If nothing clears the gates, nothing
                  is bought — we do not manufacture a pick to fill the slot.
                </p>
              </div>
            </div>
          </section>

          {/* Trust */}
          <section className="space-y-3">
            <p className="panel-label panel-label-yellow">
              What we do and don&apos;t do
            </p>
            <div className="data-card">
              <ul className="grid grid-cols-1 gap-x-8 gap-y-3 sm:grid-cols-2">
                {DISCIPLINE.map((d) => (
                  <li key={d.text} className="flex items-start gap-2.5">
                    <span
                      className={`mt-px rounded-full p-1 ${
                        d.do ? "bg-accent-mint/20" : "bg-accent-coral/20"
                      }`}
                      aria-hidden
                    >
                      {d.do ? (
                        <Check size={11} className="text-text-muted" />
                      ) : (
                        <X size={11} className="text-text-muted" />
                      )}
                    </span>
                    <span className="font-sans text-[13px] leading-relaxed text-text-muted">
                      {d.text}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </section>

          {/* Provenance */}
          <section className="space-y-3">
            <p className="panel-label">Nothing changes quietly</p>
            <div className="data-card">
              <p className="max-w-[620px] font-sans text-[13px] leading-relaxed text-text-muted">
                The rules above are fixed in advance and applied the same way
                every cycle. To prove that, we publish a fingerprint of the
                exact settings the strategy is running. If we ever change how
                picks are chosen, this changes with it — so you can hold us to
                the method you subscribed to rather than take our word for it.
              </p>
              <div className="mt-4 flex flex-wrap items-center gap-x-8 gap-y-4 border-t border-border pt-4">
                <div>
                  <p className="field-label">CURRENT METHOD</p>
                  <p className="mt-1.5 font-mono text-[14px] font-semibold tabular-nums text-text">
                    {data?.params_version ?? "—"}
                  </p>
                </div>
                <div>
                  <p className="field-label">REVIEWED</p>
                  <p className="mt-1.5 font-sans text-[14px] font-semibold capitalize text-text">
                    {cadence}
                  </p>
                </div>
                <div>
                  <p className="field-label">POSITIONS OPEN</p>
                  <p className="mt-1.5 font-mono text-[14px] font-semibold tabular-nums text-text">
                    {data?.position_count ?? data?.portfolio?.position_count ?? "—"}
                  </p>
                </div>
              </div>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
