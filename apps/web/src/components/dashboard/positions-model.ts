import type { Holding } from "@/lib/hooks/use-strategy";
import type { Pick as PickRow } from "@/lib/hooks/use-picks";
import type { Trade } from "@/lib/hooks/use-trades";
import { streetRangeFromFundamentals } from "@/lib/street-range";

/**
 * The reads the Positions page makes over data it already has.
 *
 * Positions used to be four tabs over one object, so answering "how is this
 * name doing and why do we still own it" meant finding the same row in three
 * tables. The page is now one list plus a per-name drawer; these are the
 * roll-ups that list and drawer print, kept pure so they can be tested.
 *
 * Nothing here coerces an unknown to 0. A null return, surprise or revision
 * is left out of every count and every average, and callers print "—".
 */

function known(v: number | null | undefined): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

/** Same ±0.05% band the fundamentals copy has always called "No change". */
const FLAT_PCT = 0.05;

function mean(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

// ---------------------------------------------------------------------------
// View / URL
// ---------------------------------------------------------------------------

export type PositionsView = "open" | "closed";

/**
 * `?tab=` used to take open | fundamentals | closed | activity. Fundamentals
 * now lives in each row and each drawer, and activity sits under the open
 * list, so old links land on the open view rather than on nothing.
 */
export function parsePositionsView(raw: string | null): PositionsView {
  return raw === "closed" ? "closed" : "open";
}

// ---------------------------------------------------------------------------
// Summaries
// ---------------------------------------------------------------------------

export interface OpenSummary {
  count: number;
  /** Marked above cost. Unrealized — never to be labelled a win rate. */
  above: number;
  below: number;
  /** Equal-weight mean of known unrealized returns. */
  avgPct: number | null;
  /** Holdings with a known return — the denominator of `avgPct`. */
  scored: number;
}

export function openSummary(holdings: readonly Holding[]): OpenSummary {
  const returns = holdings.map((h) => h.pnl_pct).filter(known);
  return {
    count: holdings.length,
    above: returns.filter((r) => r > 0).length,
    below: returns.filter((r) => r < 0).length,
    avgPct: mean(returns),
    scored: returns.length,
  };
}

export interface ClosedSummary {
  count: number;
  wins: number;
  /** Closed with a known result. */
  scored: number;
  winRatePct: number | null;
  avgWinPct: number | null;
  avgLossPct: number | null;
}

export function closedSummary(
  picks: readonly Pick<PickRow, "pnl_pct">[],
): ClosedSummary {
  const returns = picks.map((p) => p.pnl_pct).filter(known);
  const wins = returns.filter((r) => r > 0);
  const losses = returns.filter((r) => r <= 0);
  return {
    count: picks.length,
    wins: wins.length,
    scored: returns.length,
    winRatePct: returns.length > 0 ? (wins.length / returns.length) * 100 : null,
    avgWinPct: mean(wins),
    avgLossPct: mean(losses),
  };
}

// ---------------------------------------------------------------------------
// Per-row signals
// ---------------------------------------------------------------------------

export type EarningsRead = "beat" | "miss" | "inline";
export type RevisionRead = "up" | "down" | "flat";

export interface HoldingSignals {
  /** Latest reported EPS vs the estimate for that print; revenue if no EPS. */
  earnings: EarningsRead | null;
  /** Which line `earnings` was read from, for the tooltip. */
  earningsBasis: "EPS" | "Revenue" | null;
  earningsSurprisePct: number | null;
  /** Forward EPS consensus vs the prior snapshot. */
  revisions: RevisionRead | null;
  revisionPct: number | null;
  /** Street mean target vs the latest mark. Analyst context, not ours. */
  upsidePct: number | null;
}

function direction<T extends string>(
  pct: number,
  up: T,
  down: T,
  flat: T,
): T {
  if (Math.abs(pct) < FLAT_PCT) return flat;
  return pct > 0 ? up : down;
}

/**
 * The fundamentals table condensed to what a row can carry: did the last
 * print beat, which way are estimates moving, and how far is the Street mean
 * from here. The full numbers stay one click away in the drawer.
 */
export function holdingSignals(h: Holding): HoldingSignals {
  const f = h.fundamentals;
  let earnings: EarningsRead | null = null;
  let earningsBasis: HoldingSignals["earningsBasis"] = null;
  let earningsSurprisePct: number | null = null;
  if (known(f?.eps_surprise_pct)) {
    earningsSurprisePct = f.eps_surprise_pct;
    earningsBasis = "EPS";
  } else if (known(f?.revenue_surprise_pct)) {
    earningsSurprisePct = f.revenue_surprise_pct;
    earningsBasis = "Revenue";
  }
  if (earningsSurprisePct !== null) {
    earnings = direction(earningsSurprisePct, "beat", "miss", "inline");
  }

  const revisionPct = known(f?.eps_revision_pct) ? f.eps_revision_pct : null;
  const revisions =
    revisionPct === null ? null : direction(revisionPct, "up", "down", "flat");

  const street = streetRangeFromFundamentals(f);
  return {
    earnings,
    earningsBasis,
    earningsSurprisePct,
    revisions,
    revisionPct,
    upsidePct: street?.upsideToMeanPct ?? null,
  };
}

// ---------------------------------------------------------------------------
// Trades
// ---------------------------------------------------------------------------

/** Every trade on one name, oldest first — the position's own story. */
export function tradesForTicker(
  trades: readonly Trade[],
  ticker: string,
): Trade[] {
  return trades
    .filter((t) => t.ticker === ticker)
    .sort((a, b) => a.date.localeCompare(b.date));
}

export interface EvaluationGroup {
  key: string;
  /** Calendar date of the earliest trade in the group, `YYYY-MM-DD`. */
  date: string;
  evaluationId: number | null;
  trades: Trade[];
}

/**
 * The strategy trades in evaluation cycles, so the log reads as "what did
 * the Sep 12 run do" rather than one row per fill. Trades with no evaluation
 * (the hand-entered seed book) group by calendar date instead.
 */
export function groupTradesByEvaluation(
  trades: readonly Trade[],
): EvaluationGroup[] {
  const groups = new Map<string, EvaluationGroup>();
  for (const t of trades) {
    const day = t.date.slice(0, 10);
    const key = t.evaluation_id === null ? `day:${day}` : `eval:${t.evaluation_id}`;
    const g = groups.get(key);
    if (g) {
      g.trades.push(t);
      if (day < g.date) g.date = day;
    } else {
      groups.set(key, {
        key,
        date: day,
        evaluationId: t.evaluation_id,
        trades: [t],
      });
    }
  }
  return [...groups.values()].sort(
    (a, b) => b.date.localeCompare(a.date) || b.key.localeCompare(a.key),
  );
}
