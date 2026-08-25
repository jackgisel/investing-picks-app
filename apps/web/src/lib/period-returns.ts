import type {
  PeriodId,
  PeriodPositionRow,
  PeriodSummary,
} from "@/lib/hooks/use-period-returns";
import { comparePnl, formatWeekdayDate } from "@/lib/portfolio";

export const PERIOD_ORDER: readonly PeriodId[] = ["day", "week", "month"];

/** Tab labels. Shorter than the API's, which are written for a tile. */
export const PERIOD_TAB_LABEL: Record<PeriodId, string> = {
  day: "Today",
  week: "This week",
  month: "This month",
};

/**
 * What the period is measured from, in words.
 *
 * The anchor is a session, not a boundary — the week runs from Friday's close,
 * not from Monday morning — and a reader cannot infer that from "+2.8% this
 * week". Stating it is what stops the number being read against the wrong
 * start, particularly on a Monday, when "this week" and "today" are the same
 * move and the two tiles legitimately agree.
 */
export function periodCaption(summary: PeriodSummary | undefined): string {
  const from = formatWeekdayDate(summary?.from_date);
  if (!from) return "No prior session";
  return `since ${from} close`;
}

/**
 * The label for a position measured from its entry rather than from the
 * period anchor. Null when the row is a normal full-period return.
 */
export function partialNote(
  row: PeriodPositionRow,
  period: PeriodId,
): string | null {
  const cell = row.periods[period];
  if (!cell?.partial) return null;
  const from = formatWeekdayDate(cell.from_date);
  return from ? `since entry ${from}` : "since entry";
}

/**
 * How the held-sleeve number is qualified, or null when nothing was left out.
 *
 * A sleeve return that silently covered 6 of 9 picks would read as the book's
 * week. Naming the exclusions is the difference between a number and a claim.
 */
export function sleeveNote(summary: PeriodSummary | undefined): string | null {
  if (!summary) return null;
  const n = summary.open_picks_excluded_new;
  if (!n) return null;
  const noun = n === 1 ? "pick" : "picks";
  return `${n} newer ${noun} excluded`;
}

/** Rows sorted by one period's return. Unknowns sort last in both directions. */
export function sortByPeriod(
  rows: readonly PeriodPositionRow[],
  period: PeriodId,
  dir: "asc" | "desc" = "desc",
): PeriodPositionRow[] {
  return [...rows].sort((a, b) =>
    comparePnl(a.periods[period]?.return_pct, b.periods[period]?.return_pct, dir),
  );
}

/**
 * How many of the book's picks the period covers, as "7 of 9".
 *
 * Returns null when nothing was excluded — the qualifier would be noise.
 */
export function coverageNote(
  summary: PeriodSummary | undefined,
): string | null {
  if (!summary || !summary.open_picks_excluded_new) return null;
  const total = summary.open_picks_positions + summary.open_picks_excluded_new;
  return `${summary.open_picks_positions} of ${total} picks`;
}
