import type { StrategyData, Holding } from "@/lib/hooks/use-strategy";
import {
  FOUNDERS_DEAL_MAX_DAY,
  LIVE_PORTFOLIO,
} from "@/lib/constants";

/**
 * Cumulative return on the stocks we picked — the headline number.
 *
 * Definition (backend: `app.services.portfolio.picks_return`):
 *
 *     (proceeds from closed picks + market value of open picks)
 *     / capital deployed - 1
 *
 * Outpick sells stock research, not a managed portfolio, so the number that
 * describes the product is what the picks did with the money actually put into
 * them. Idle cash neither helps nor hurts it.
 *
 * Closed picks are included on purpose. Counting only open positions would be
 * survivorship bias — sold losers would drop out of the record while winners
 * stayed.
 *
 * This is deliberately NOT the same as the whole-book equity return, which is
 * dragged down by uninvested cash; see `computeBookReturnPct` for that.
 */
export function computePortfolioReturnPct(
  strategy: StrategyData | undefined
): number | null {
  if (!strategy?.portfolio) return null;
  const picks = strategy.portfolio.picks_return_pct;
  if (typeof picks === "number") return picks;
  // Older API responses only carried the equity return.
  return strategy.portfolio.total_return_pct ?? null;
}

/**
 * Whole-book equity return: (cash + holdings) / initial capital - 1.
 *
 * The honest portfolio-level number, cash drag included. Diverges sharply from
 * the picks return whenever the book is only partly invested.
 */
export function computeBookReturnPct(
  strategy: StrategyData | undefined
): number | null {
  if (!strategy?.portfolio) return null;
  return strategy.portfolio.total_return_pct ?? null;
}

export function formatPct(n: number, digits = 2): string {
  const sign = n >= 0 ? "+" : "";
  return `${sign}${n.toFixed(digits)}%`;
}

/** `formatPct` for values that may be unknown. Never coerce null to zero. */
export function formatPctOrDash(n: number | null | undefined, digits = 2) {
  return typeof n === "number" ? formatPct(n, digits) : "—";
}

/**
 * The colour for a P&L figure.
 *
 * Three cases the inlined `n >= 0 ? green : red` ternary got wrong:
 *
 *   - `null` is unknown, not a gain. Rendering it green (and, with `?? 0`,
 *     as "+0.00%") invents a result we do not have.
 *   - Exactly flat is not a gain either.
 *   - Colour is never the only signal — `formatPct` emits +/- for everyone
 *     who can't rely on it, so always pair this with `formatPct`.
 */
export function pnlClass(n: number | null | undefined): string {
  if (typeof n !== "number") return "text-text-dim";
  if (n > 0) return "text-accent-green";
  if (n < 0) return "text-accent-red";
  return "text-text-muted";
}

export function daysSinceInception(
  inceptionISO: string = LIVE_PORTFOLIO.inceptionISO
): number {
  const start = new Date(inceptionISO).getTime();
  const now = Date.now();
  return Math.max(0, Math.floor((now - start) / (1000 * 60 * 60 * 24)));
}

/** Whole days between two ISO dates (end - start). */
export function daysBetweenISO(startISO: string, endISO: string): number {
  const start = new Date(startISO).getTime();
  const end = new Date(endISO).getTime();
  return Math.max(0, Math.floor((end - start) / (1000 * 60 * 60 * 24)));
}

/**
 * Days of daily history we actually hold — the span of the snapshot series.
 *
 * This is NOT the window a since-inception return is annualized over. It used
 * to be, and that was the bug: `portfolio_snapshots` only starts accruing when
 * the worker runs, so a book entered long after its nominal inception had one
 * day of history, and the card rendered "Day 115" beside a CAGR extrapolated
 * from a single day. Use it as a corroboration check only — see
 * {@link resolveLiveCagr}.
 */
export function liveAccrualDays(window?: {
  start_date?: string | null;
  latest_date?: string | null;
}): number {
  if (window?.start_date && window?.latest_date) {
    return daysBetweenISO(window.start_date, window.latest_date);
  }
  return 0;
}

export function isFoundersDealActive(
  day: number = daysSinceInception()
): boolean {
  return day < FOUNDERS_DEAL_MAX_DAY;
}

export function foundersDealDaysRemaining(
  day: number = daysSinceInception()
): number {
  return Math.max(0, FOUNDERS_DEAL_MAX_DAY - day);
}

/**
 * Shortest live window we will annualize.
 *
 * Below one quarter, extrapolating to a year is arithmetic rather than
 * evidence: +26.81% over a day annualizes to roughly 10^100%. Mirrors
 * `MIN_CAGR_WINDOW_DAYS` in `apps/api/app/routes/public_v1.py`, which is the
 * source of truth when the API reports it.
 */
export const MIN_CAGR_WINDOW_DAYS = 90;

/**
 * How much of the book's life must be covered by daily snapshots before the
 * annualized figure is shown. Mirrors `MIN_HISTORY_COVERAGE` in the API.
 */
export const MIN_HISTORY_COVERAGE = 0.8;

/**
 * Annualized return extrapolated from a since-inception return.
 *
 * `daysLive` must be wall-clock days since inception, because the return being
 * annualized is itself measured from inception. Annualizing it over the length
 * of the *snapshot window* is what let the card claim "Day 115" beside a CAGR
 * derived from a single day of data.
 */
export function computeAnnualizedReturn(
  totalReturnPct: number,
  daysLive: number,
  minWindowDays: number = MIN_CAGR_WINDOW_DAYS
): number | null {
  if (daysLive < minWindowDays) return null;
  const mult = 1 + totalReturnPct / 100;
  if (mult <= 0) return null;
  return (Math.pow(mult, 365 / daysLive) - 1) * 100;
}

export type LiveCagrStatus =
  | "ok"
  | "window_too_short"
  | "insufficient_history"
  | "not_meaningful"
  | "unavailable";

export interface LiveCagr {
  status: LiveCagrStatus;
  /** Annualized percent, only when `status === "ok"`. */
  value: number | null;
  /** Wall-clock days since inception — the same number the "Day N" badge shows. */
  daysLive: number;
  /** Days of daily history actually recorded. */
  daysRecorded: number;
  minWindowDays: number;
}

export interface PerformanceSummaryWindow {
  start_date?: string | null;
  latest_date?: string | null;
  inception_date?: string | null;
  annualized_return_pct?: number | null;
  annualized_status?: string | null;
  days_live?: number | null;
  days_recorded?: number | null;
  min_window_days?: number | null;
}

const KNOWN_STATUSES: LiveCagrStatus[] = [
  "ok",
  "window_too_short",
  "insufficient_history",
  "not_meaningful",
  "unavailable",
];

/**
 * The one place the landing page decides whether a live CAGR may be shown.
 *
 * Both notions of elapsed time are reconciled here rather than in each card:
 *
 *   - `daysLive` (days since inception) is the annualization denominator and
 *     the number the "Day N" badge renders, so the two can never disagree.
 *   - `daysRecorded` (the snapshot window) is only a corroboration check. A
 *     performance claim that the published chart cannot back up does not get
 *     made, even if the underlying return is sound.
 *
 * Prefers the API's own verdict when present so the marketing page and the
 * backend cannot drift apart; falls back to the identical local rule otherwise.
 */
export function resolveLiveCagr(
  totalReturnPct: number | null,
  summary?: PerformanceSummaryWindow
): LiveCagr {
  const minWindowDays = summary?.min_window_days ?? MIN_CAGR_WINDOW_DAYS;
  const daysLive = summary?.days_live ?? daysSinceInception();
  const daysRecorded = summary?.days_recorded ?? liveAccrualDays(summary);

  const base = { daysLive, daysRecorded, minWindowDays };

  const apiStatus = summary?.annualized_status;
  if (apiStatus && (KNOWN_STATUSES as string[]).includes(apiStatus)) {
    const status = apiStatus as LiveCagrStatus;
    const value =
      status === "ok" ? summary?.annualized_return_pct ?? null : null;
    // An "ok" verdict with no number is not a claim we can render.
    return { ...base, status: value === null && status === "ok" ? "unavailable" : status, value };
  }

  if (totalReturnPct === null || daysLive <= 0) {
    return { ...base, status: "unavailable", value: null };
  }
  if (daysLive < minWindowDays) {
    return { ...base, status: "window_too_short", value: null };
  }
  if (daysRecorded < MIN_HISTORY_COVERAGE * daysLive) {
    return { ...base, status: "insufficient_history", value: null };
  }
  const value = computeAnnualizedReturn(totalReturnPct, daysLive, minWindowDays);
  if (value === null) {
    return { ...base, status: "not_meaningful", value: null };
  }
  return { ...base, status: "ok", value };
}

/**
 * Why the live CAGR is blank, in plain language.
 *
 * A bare em-dash on a performance card reads as "broken" or, worse, as
 * something being withheld. Say what is missing and when it arrives.
 */
export function describeLiveCagr(cagr: LiveCagr): string | null {
  switch (cagr.status) {
    case "ok":
      return null;
    case "window_too_short":
      return `Needs ${cagr.minWindowDays} days live before annualizing — day ${cagr.daysLive} of ${cagr.minWindowDays}.`;
    case "insufficient_history":
      return `Verified daily history covers ${cagr.daysRecorded} of ${cagr.daysLive} days live. We publish this once the record is complete.`;
    case "not_meaningful":
      return "The book is down more than 100%, which has no meaningful annualized rate.";
    default:
      return "Live performance data isn't available right now.";
  }
}

/** Positions that have at least doubled (≥100% gain). */
export function countDoubledWinners(
  holdings: Holding[] | undefined,
  minPct = 100
): number {
  if (!holdings?.length) return 0;
  return holdings.filter((h) => h.pnl_pct >= minPct).length;
}

export function countWinningPositions(
  holdings: Holding[] | undefined
): number {
  if (!holdings?.length) return 0;
  return holdings.filter((h) => h.pnl_pct > 0).length;
}
