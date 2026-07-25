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
 * Number of days the live return has actually accrued.
 *
 * Prefers the real data window reported by the backend performance summary
 * (start_date → latest_date) so annualized figures match the data instead of
 * the wall-clock calendar. Falls back to days since inception when the window
 * isn't available yet.
 */
export function liveAccrualDays(window?: {
  start_date?: string | null;
  latest_date?: string | null;
}): number {
  if (window?.start_date && window?.latest_date) {
    return daysBetweenISO(window.start_date, window.latest_date);
  }
  return daysSinceInception();
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

/** Annualized return extrapolated from live total return and days elapsed. */
export function computeAnnualizedReturn(
  totalReturnPct: number,
  daysLive: number
): number | null {
  if (daysLive < 7) return null;
  const mult = 1 + totalReturnPct / 100;
  if (mult <= 0) return null;
  return (Math.pow(mult, 365 / daysLive) - 1) * 100;
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
