"use client";

import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import type { Holding } from "@/lib/hooks/use-strategy";
import { formatDayMonth } from "@/lib/portfolio";
import {
  concentration,
  revisionPulse,
  surprisePulse,
} from "@/components/dashboard/pulse-model";

function signed(pct: number, digits = 1): string {
  return `${pct > 0 ? "+" : ""}${pct.toFixed(digits)}%`;
}

function driftClass(pct: number | null): string {
  if (pct === null) return "text-text";
  if (pct > 0) return "text-accent-green";
  if (pct < 0) return "text-accent-red";
  return "text-text";
}

/**
 * One cell of the pulse panel: a label, a headline, and a line of detail.
 * Deliberately a `dl`, since each is a term with a value.
 */
function Cell({
  label,
  headline,
  headlineClass = "text-text",
  detail,
  footnote,
}: {
  label: string;
  headline: string;
  headlineClass?: string;
  detail: React.ReactNode;
  footnote?: string | null;
}) {
  return (
    <div className="px-5 py-4">
      <dt className="field-label">{label}</dt>
      <dd className="mt-2">
        <span
          className={`block font-mono text-[18px] font-bold leading-tight tabular-nums ${headlineClass}`}
        >
          {headline}
        </span>
        <span className="mt-1.5 block font-sans text-[12px] leading-snug text-text-muted">
          {detail}
        </span>
        {footnote && (
          <span className="mt-1 block font-sans text-[10px] leading-snug text-text-dim">
            {footnote}
          </span>
        )}
      </dd>
    </div>
  );
}

/**
 * What the book's fundamentals are doing, in three cells.
 *
 * Every number here was already on Positions > Fundamentals, one row per
 * name. Rolled up, they answer the question a subscriber actually opens the
 * dashboard with — "is anything changing under these positions?" — without
 * sending them to an eleven-row table to work it out.
 *
 * Three honesty rules, enforced in `pulse-model.ts`:
 *   - Revisions are since the PRIOR fundamentals snapshot, not since entry.
 *   - "Latest reports" is a look back. The payload has no forward earnings
 *     calendar, so nothing here claims to know when the next print is.
 *   - Concentration is a share of INVESTED capital, so a mostly-cash book
 *     still reports how lopsided the positions themselves are.
 */
export function HoldingsPulse({ holdings }: { holdings: readonly Holding[] }) {
  if (holdings.length === 0) return null;

  const rev = revisionPulse(holdings);
  const sur = surprisePulse(holdings);
  const conc = concentration(holdings);

  const hasRevisions = rev.scored > 0;
  const hasSurprises = sur.revenueScored > 0 || sur.epsScored > 0;
  const hasWeights = conc.top !== null;
  if (!hasRevisions && !hasSurprises && !hasWeights) return null;

  const asOf = formatDayMonth(rev.asOf);
  const latest = formatDayMonth(sur.latestReport);

  return (
    <div className="data-panel">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
        <span className="panel-label panel-label-mint">Holdings pulse</span>
        <Link
          href="/dashboard/positions"
          className="flex shrink-0 items-center gap-1 font-sans text-[10px] font-bold tracking-[0.08em] text-text underline underline-offset-2 hover:opacity-70"
        >
          POSITIONS <ArrowUpRight size={10} strokeWidth={2.5} />
        </Link>
      </div>

      <dl className="grid grid-cols-1 divide-y divide-border sm:grid-cols-3 sm:divide-x sm:divide-y-0">
        {hasRevisions ? (
          <Cell
            label="EPS revisions"
            headline={`${rev.up} of ${rev.scored} up`}
            headlineClass={
              rev.up > rev.down
                ? "text-accent-green"
                : rev.down > rev.up
                  ? "text-accent-red"
                  : "text-text"
            }
            detail={
              <>
                {rev.down > 0 ? `${rev.down} cut` : "None cut"}
                {rev.flat > 0 ? ` · ${rev.flat} unchanged` : ""}
                {rev.medianPct !== null && (
                  <>
                    {" · median "}
                    <span className={`font-mono tabular-nums ${driftClass(rev.medianPct)}`}>
                      {signed(rev.medianPct)}
                    </span>
                  </>
                )}
                {rev.topUp && (
                  <>
                    {" · biggest "}
                    <span className="font-mono text-text">{rev.topUp.ticker}</span>{" "}
                    <span className="font-mono tabular-nums text-accent-green">
                      {signed(rev.topUp.pct)}
                    </span>
                  </>
                )}
              </>
            }
            footnote={`Consensus FY estimate drift since the prior snapshot${asOf ? ` · as of ${asOf}` : ""}${
              rev.scored < rev.total ? ` · ${rev.total - rev.scored} unscored` : ""
            }`}
          />
        ) : (
          <Cell
            label="EPS revisions"
            headline="—"
            detail="No revision data in the latest fundamentals snapshot."
          />
        )}

        {hasSurprises ? (
          <Cell
            label="Latest reports"
            headline={
              sur.epsScored > 0
                ? `${sur.epsBeats} of ${sur.epsScored} beat`
                : `${sur.revenueBeats} of ${sur.revenueScored} beat`
            }
            headlineClass={
              sur.epsScored > 0
                ? sur.epsBeats * 2 >= sur.epsScored
                  ? "text-accent-green"
                  : "text-accent-red"
                : "text-text"
            }
            detail={
              <>
                {sur.epsScored > 0 ? "On EPS" : "On revenue"}
                {sur.epsScored > 0 && sur.revenueScored > 0
                  ? ` · ${sur.revenueBeats} of ${sur.revenueScored} on revenue`
                  : ""}
                {latest && (
                  <>
                    {" · most recent "}
                    <span className="font-mono text-text">{latest}</span>
                    {sur.latestTickers.length > 0 && (
                      <>
                        {" "}
                        <span className="font-mono text-text-dim">
                          ({sur.latestTickers.slice(0, 3).join(", ")}
                          {sur.latestTickers.length > 3
                            ? ` +${sur.latestTickers.length - 3}`
                            : ""}
                          )
                        </span>
                      </>
                    )}
                  </>
                )}
              </>
            }
            footnote="Last reported quarter vs consensus at the time. We do not publish a forward earnings calendar."
          />
        ) : (
          <Cell
            label="Latest reports"
            headline="—"
            detail="No reported-quarter data in the latest fundamentals snapshot."
          />
        )}

        {hasWeights && conc.top ? (
          <Cell
            label="Concentration"
            headline={`${conc.top.weightPct.toFixed(1)}%`}
            detail={
              <>
                <span className="font-mono text-text">{conc.top.ticker ?? "—"}</span>
                {" is the largest position"}
                {conc.topThreePct !== null && (
                  <>
                    {" · top 3 hold "}
                    <span className="font-mono tabular-nums text-text">
                      {conc.topThreePct.toFixed(0)}%
                    </span>
                    {" of invested"}
                  </>
                )}
                {" · "}
                {conc.houseMoney === 0
                  ? "none on house money"
                  : `${conc.houseMoney} on house money`}
              </>
            }
            footnote="Share of invested capital, idle cash excluded. House money: the original stake was already recovered by a partial sell."
          />
        ) : (
          <Cell
            label="Concentration"
            headline="—"
            detail="Position weights are not available right now."
          />
        )}
      </dl>
    </div>
  );
}
