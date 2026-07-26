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
          {/* What we measure */}
          <section className="space-y-3">
            <p className="panel-label panel-label-mint">
              What we score, and why
            </p>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {FACTORS.map((f) => (
                <FactorCard key={f.name} {...f} />
              ))}
              <div className="data-card flex flex-col justify-center bg-transparent">
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
            <p className="panel-label panel-label-cyan">
              Everything is judged against its own sector
            </p>
            <SectorRelativeExample />
          </section>

          {/* How a pick is chosen */}
          <section className="space-y-3">
            <p className="panel-label panel-label-lilac">How a pick is chosen</p>
            <PickFunnel />
          </section>

          {/* What happens after */}
          <section className="space-y-3">
            <p className="panel-label panel-label-peach">
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
            <p className="panel-label panel-label-coral">The risk contract</p>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="data-card">
                <p className="field-label">SECTOR CEILING</p>
                <p className="mt-1.5 font-mono text-xl font-bold tabular-nums text-text">
                  {sectorCap === null ? "—" : `${Math.round(sectorCap * 100)}%`}
                </p>
                <p className="mt-2 font-sans text-[12px] leading-relaxed text-text-dim">
                  No sector may exceed this share of the book. Enforced on every
                  buy, not reviewed after the fact.
                </p>
              </div>
              <div className="data-card">
                <p className="field-label">MAX POSITIONS</p>
                <p className="mt-1.5 font-mono text-xl font-bold tabular-nums text-text">
                  {maxPositions ?? "—"}
                </p>
                <p className="mt-2 font-sans text-[12px] leading-relaxed text-text-dim">
                  A ceiling on how thin the book can get. Conviction shows up as
                  what we buy, never as an oversized bet.
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
            <p className="panel-label">Engine</p>
            <div className="data-panel">
              <div className="grid grid-cols-2 divide-x divide-border border-b border-border sm:grid-cols-4 sm:divide-y-0">
                {[
                  { label: "STRATEGY", value: data?.name ?? data?.strategy?.name ?? "—" },
                  { label: "VERSION", value: data?.params_version ?? "—", mono: true },
                  { label: "CADENCE", value: cadence },
                  {
                    label: "OPEN / MAX",
                    value: `${data?.position_count ?? data?.portfolio?.position_count ?? "—"} / ${maxPositions ?? "—"}`,
                    mono: true,
                  },
                ].map((c) => (
                  <div key={c.label} className="px-5 py-4">
                    <p className="field-label">{c.label}</p>
                    <p
                      className={`mt-1.5 text-[14px] font-semibold text-text ${
                        c.mono ? "font-mono tabular-nums" : "font-sans"
                      }`}
                    >
                      {c.value}
                    </p>
                  </div>
                ))}
              </div>
              <p className="px-5 py-4 font-sans text-[12px] leading-relaxed text-text-dim">
                The version is a fingerprint of the exact parameter set the
                engine is running. It is published so a subscriber can tell that
                the strategy trading the live book is the same one that produced
                the backtest — and can tell when it changes.
              </p>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
