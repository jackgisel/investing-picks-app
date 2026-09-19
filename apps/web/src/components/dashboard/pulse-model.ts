import type { Holding } from "@/lib/hooks/use-strategy";
import { asShareOfInvested } from "./sector-model";

/**
 * Glance-level reads over the holdings we already publish.
 *
 * Every field below has been in the `/api/data/strategy` payload for months
 * and was rendered only on Positions > Fundamentals, one row per name — which
 * is where you go to check a company, not where you learn what the book as a
 * whole is doing. These roll them up so the dashboard home can say "analysts
 * are marking the book up" or "one name is a fifth of invested capital" in a
 * line.
 *
 * Pure functions, kept apart from the component so they can be tested
 * without a renderer. Nothing in here invents a number: a holding with no
 * fundamentals is left out of the counts and the caller says how many were.
 */

function known(v: number | null | undefined): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

/** Anything inside ±0.05% is "unchanged" — the same threshold the
 *  fundamentals table uses to print "No change". */
const FLAT_PCT = 0.05;

export interface RevisionPulse {
  /** Holdings whose consensus EPS estimate drifted up since the prior snapshot. */
  up: number;
  down: number;
  flat: number;
  /** Holdings with a known revision — the denominator. */
  scored: number;
  /** Holdings in the book, including those with no fundamentals. */
  total: number;
  /** Median EPS revision across scored names, or null when none are scored. */
  medianPct: number | null;
  /** Largest positive move, if any. */
  topUp: { ticker: string; pct: number } | null;
  /** Largest negative move, if any. */
  topDown: { ticker: string; pct: number } | null;
  /** The fundamentals snapshot the revisions were struck against. */
  asOf: string | null;
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * Direction of analyst EPS revisions across the book.
 *
 * Revisions are the strategy's most forward-looking input (see the Strategy
 * page), so "9 of 11 names revised up" is the single most useful sentence the
 * dashboard can add about what we hold. The change is against the PRIOR
 * fundamentals snapshot, not since entry — the caller must say so.
 */
export function revisionPulse(holdings: readonly Holding[]): RevisionPulse {
  let up = 0;
  let down = 0;
  let flat = 0;
  const values: number[] = [];
  let topUp: RevisionPulse["topUp"] = null;
  let topDown: RevisionPulse["topDown"] = null;
  let asOf: string | null = null;

  for (const h of holdings) {
    const pct = h.fundamentals?.eps_revision_pct;
    if (!known(pct)) continue;
    values.push(pct);
    if (!asOf || (h.fundamentals?.as_of ?? "") > asOf) {
      asOf = h.fundamentals?.as_of ?? asOf;
    }
    if (Math.abs(pct) < FLAT_PCT) {
      flat += 1;
      continue;
    }
    if (pct > 0) {
      up += 1;
      if (h.ticker && (!topUp || pct > topUp.pct)) topUp = { ticker: h.ticker, pct };
    } else {
      down += 1;
      if (h.ticker && (!topDown || pct < topDown.pct))
        topDown = { ticker: h.ticker, pct };
    }
  }

  return {
    up,
    down,
    flat,
    scored: values.length,
    total: holdings.length,
    medianPct: median(values),
    topUp,
    topDown,
    asOf,
  };
}

export interface SurprisePulse {
  /** Names that beat revenue consensus on their latest report. */
  revenueBeats: number;
  /** Names that beat EPS consensus on their latest report. */
  epsBeats: number;
  /** Names with a known surprise on that line. */
  revenueScored: number;
  epsScored: number;
  total: number;
  /** The most recent report date in the book, ISO `YYYY-MM-DD`. */
  latestReport: string | null;
  /** Tickers that reported on `latestReport`. */
  latestTickers: string[];
}

/**
 * How the book's latest reported quarters landed against consensus.
 *
 * `earnings_report_date` is the LAST report, not the next one — FMP's
 * forward calendar is not in this payload — so this is a look back, and the
 * label has to read that way. "Upcoming earnings" would be an invention.
 */
export function surprisePulse(holdings: readonly Holding[]): SurprisePulse {
  let revenueBeats = 0;
  let epsBeats = 0;
  let revenueScored = 0;
  let epsScored = 0;
  let latestReport: string | null = null;

  for (const h of holdings) {
    const f = h.fundamentals;
    if (!f) continue;
    if (known(f.revenue_surprise_pct)) {
      revenueScored += 1;
      if (f.revenue_surprise_pct > 0) revenueBeats += 1;
    }
    if (known(f.eps_surprise_pct)) {
      epsScored += 1;
      if (f.eps_surprise_pct > 0) epsBeats += 1;
    }
    if (f.earnings_report_date && (!latestReport || f.earnings_report_date > latestReport)) {
      latestReport = f.earnings_report_date;
    }
  }

  const latestTickers = latestReport
    ? holdings
        .filter((h) => h.ticker && h.fundamentals?.earnings_report_date === latestReport)
        .map((h) => h.ticker as string)
    : [];

  return {
    revenueBeats,
    epsBeats,
    revenueScored,
    epsScored,
    total: holdings.length,
    latestReport,
    latestTickers,
  };
}

export interface Concentration {
  /** Heaviest position as a share of INVESTED capital, with its ticker. */
  top: { ticker: string | null; weightPct: number } | null;
  /** Combined share of the three heaviest names. */
  topThreePct: number | null;
  /** Positions running on profit — original stake already recovered. */
  houseMoney: number;
  total: number;
}

/**
 * Where the book's risk sits.
 *
 * Weights are rebased onto invested capital (see `asShareOfInvested`), so a
 * book that is 13% invested still reads "SEZL is 15% of what we own" rather
 * than "SEZL is 2% of equity", which is true and useless.
 */
export function concentration(holdings: readonly Holding[]): Concentration {
  const rebased = asShareOfInvested(holdings)
    .filter((h) => known(h.weight_pct))
    .sort((a, b) => (b.weight_pct as number) - (a.weight_pct as number));

  const top = rebased[0]
    ? { ticker: rebased[0].ticker, weightPct: rebased[0].weight_pct as number }
    : null;
  const topThreePct =
    rebased.length > 0
      ? rebased.slice(0, 3).reduce((n, h) => n + (h.weight_pct as number), 0)
      : null;

  return {
    top,
    topThreePct,
    houseMoney: holdings.filter((h) => h.is_house_money === true).length,
    total: holdings.length,
  };
}

/**
 * The two halves of the open book for the home page.
 *
 * "Top" and "worst" used to be two independent sorts of the same list, so on
 * a book of five names both panels showed the same five rows in opposite
 * order, and on an all-green book the "worst" panel was full of gains. The
 * bottom list now excludes anything already in the top list, and the caller
 * labels both as what they are — the ends of an unrealized P&L ranking.
 * Unknown returns sort out of both (see `comparePnl`).
 */
export function splitLeadersAndLaggards<
  T extends { ticker: string | null; pnl_pct: number | null },
>(holdings: readonly T[], size = 5): { leaders: T[]; laggards: T[] } {
  const scored = holdings.filter((h) => known(h.pnl_pct));
  const desc = [...scored].sort(
    (a, b) => (b.pnl_pct as number) - (a.pnl_pct as number),
  );
  const leaders = desc.slice(0, size);
  const taken = new Set(leaders);
  const laggards = [...desc]
    .reverse()
    .filter((h) => !taken.has(h))
    .slice(0, size);
  return { leaders, laggards };
}

/**
 * Empty copy for the leading / trailing panels.
 *
 * The trailing list is empty in three different situations and they must not
 * share a sentence. An empty book is not "every scored name is already in
 * leading". A book whose marks have not landed is not empty.
 */
export function leadersLaggardsEmptyCopy(
  kind: "leaders" | "laggards",
  bookSize: number,
  scoredSize: number,
): string {
  if (bookSize === 0) return "The book is empty right now.";
  if (scoredSize === 0) return "No marked returns to rank yet.";
  if (kind === "laggards") {
    return "Every scored position is already in the leading list.";
  }
  return "The book is empty right now.";
}
