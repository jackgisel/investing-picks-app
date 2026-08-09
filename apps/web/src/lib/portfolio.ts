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

/**
 * Parse a plain `YYYY-MM-DD` as a LOCAL calendar date.
 *
 * `new Date("2026-08-07")` is UTC midnight, which formats as the 6th for every
 * viewer west of Greenwich. These are calendar dates — a scoring date, an
 * evaluation Friday — not instants, so they must not be shifted by timezone.
 */
function parseCalendarDate(iso: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return null;
  const [year, month, day] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const d = new Date(year, month - 1, day);
  // The Date constructor rolls out-of-range parts over silently — month 13 day
  // 45 becomes the following February — so a malformed date would format as a
  // confident, wrong day rather than failing. Read the parts back.
  if (
    d.getFullYear() !== year ||
    d.getMonth() !== month - 1 ||
    d.getDate() !== day
  ) {
    return null;
  }
  return d;
}

/** `2026-07-26` -> `26 Jul`. Null when the input is not a calendar date. */
export function formatDayMonth(iso: string | null | undefined): string | null {
  const d = iso ? parseCalendarDate(iso) : null;
  return d
    ? d.toLocaleDateString("en-GB", { day: "numeric", month: "short" })
    : null;
}

/** `2026-08-07` -> `Fri 7 Aug`. Null when the input is not a calendar date. */
export function formatWeekdayDate(iso: string | null | undefined): string | null {
  const d = iso ? parseCalendarDate(iso) : null;
  return d
    ? d.toLocaleDateString("en-GB", {
        weekday: "short",
        day: "numeric",
        month: "short",
      })
    : null;
}

/**
 * Sort comparator for a P&L that may be unknown.
 *
 * An unknown always sorts LAST, in both directions — it is not a big number or
 * a small one. Plain `a.pnl_pct - b.pnl_pct` yields NaN against a null, and a
 * NaN comparator makes the whole sort order arbitrary, which quietly seeds the
 * "top performers" and "worst performers" lists with positions whose return
 * nobody knows.
 */
export function comparePnl(
  a: number | null | undefined,
  b: number | null | undefined,
  dir: "asc" | "desc" = "desc",
): number {
  const aKnown = typeof a === "number" && !Number.isNaN(a);
  const bKnown = typeof b === "number" && !Number.isNaN(b);
  if (!aKnown && !bKnown) return 0;
  if (!aKnown) return 1;
  if (!bKnown) return -1;
  return dir === "desc" ? (b as number) - (a as number) : (a as number) - (b as number);
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
  /** Annualized WHOLE-BOOK EQUITY return — the pair for `total_return_pct`. */
  annualized_return_pct?: number | null;
  annualized_status?: string | null;
  /** Annualized PICKS return — the pair for `picks_return_pct`. */
  picks_annualized_return_pct?: number | null;
  picks_annualized_status?: string | null;
  days_live?: number | null;
  days_recorded?: number | null;
  min_window_days?: number | null;
}

/**
 * Which return a caller is annualizing.
 *
 * Explicit because the two bases diverge enormously on a partly-invested book —
 * 21% on the picks against 2% on the book when a tenth of the capital is
 * deployed — and the summary carries both. A caller that takes the wrong one
 * publishes a real number computed from a quantity it is not displaying.
 */
export type ReturnBasis = "picks" | "equity";

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
 *
 * `basis` decides WHICH of the summary's two annualized figures is read, and it
 * must name the same return the caller is rendering as its headline. The
 * landing page used to pass the picks return here and get back the equity
 * return annualized, because the API only published the equity pair and this
 * function reached for it unconditionally — so the stats bar showed +21.36%
 * total beside +6.43% annualized, two bases with nothing saying so. Passing the
 * number and the basis separately is what makes that mistake impossible to
 * repeat silently: the argument is required, so a caller must state its basis.
 */
export function resolveLiveCagr(
  totalReturnPct: number | null,
  summary: PerformanceSummaryWindow | undefined,
  basis: ReturnBasis
): LiveCagr {
  const minWindowDays = summary?.min_window_days ?? MIN_CAGR_WINDOW_DAYS;
  const daysLive = summary?.days_live ?? daysSinceInception();
  const daysRecorded = summary?.days_recorded ?? liveAccrualDays(summary);

  const base = { daysLive, daysRecorded, minWindowDays };

  const apiStatus =
    basis === "picks"
      ? summary?.picks_annualized_status
      : summary?.annualized_status;
  const apiValue =
    basis === "picks"
      ? summary?.picks_annualized_return_pct
      : summary?.annualized_return_pct;

  if (apiStatus && (KNOWN_STATUSES as string[]).includes(apiStatus)) {
    const status = apiStatus as LiveCagrStatus;
    const value = status === "ok" ? apiValue ?? null : null;
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
  // A holding whose return is unknown is not a doubled winner. Stated rather
  // than relying on `null >= 100` evaluating false by coercion.
  return holdings.filter(
    (h) => typeof h.pnl_pct === "number" && h.pnl_pct >= minPct,
  ).length;
}

/**
 * Open positions currently marked above cost.
 *
 * NOT a win rate, and must never be labelled one. These are unrealized marks
 * on positions that are still running: a book that opened into a rising
 * fortnight shows 8 of 8 and has proven nothing. The realized figure is
 * `closedWinRate`.
 */
export function countWinningPositions(
  holdings: Holding[] | undefined
): number {
  if (!holdings?.length) return 0;
  // Unknown is not "above cost". Excluded explicitly for the same reason as
  // countDoubledWinners.
  return holdings.filter((h) => typeof h.pnl_pct === "number" && h.pnl_pct > 0)
    .length;
}

export interface ClosedWinRate {
  /** Closed positions that finished above cost. */
  wins: number;
  /** Closed positions with a known result. */
  total: number;
  /** wins/total as a percentage, or null when there is nothing to divide. */
  pct: number | null;
}

/**
 * The win rate the product can actually stand behind: closed positions that
 * finished in the green, over all closed positions.
 *
 * A pick with a null `pnl_pct` is excluded from BOTH sides rather than counted
 * as a loss — an unknown result is not a bad one, and burying it in the
 * denominator understates the record just as silently as omitting losers would
 * overstate it.
 *
 * Returns pct: null rather than 0 for an empty book. Zero closed positions is
 * "no record yet"; rendering it as 0% is a claim, and the wrong one.
 */
export function closedWinRate(
  picks: { pnl_pct: number | null }[] | undefined
): ClosedWinRate {
  const scored = (picks ?? []).filter(
    (p): p is { pnl_pct: number } => typeof p.pnl_pct === "number",
  );
  const wins = scored.filter((p) => p.pnl_pct > 0).length;
  return {
    wins,
    total: scored.length,
    pct: scored.length > 0 ? (wins / scored.length) * 100 : null,
  };
}
