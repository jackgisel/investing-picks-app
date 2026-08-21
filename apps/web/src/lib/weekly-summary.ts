import type { WeeklyMove } from "@/lib/email-templates";

/**
 * Arithmetic shared by the Friday weekly review.
 *
 * The Sunday stats digest that used these numbers is gone. The helpers stay
 * because the written review still needs a week change, a period label, and
 * reader-facing moves — percentages only, same rule as every published surface.
 */

type PerformancePoint = { date?: string; return_pct?: number | null };

type ApiTrade = {
  ticker?: string | null;
  side?: string | null;
  date?: string | null;
};

/** "3–9 August 2026" — the week the review covers. */
export function periodLabel(weekEnd: Date): string {
  const start = new Date(weekEnd);
  start.setDate(start.getDate() - 6);
  const month = new Intl.DateTimeFormat("en-GB", {
    month: "long",
    timeZone: "UTC",
  });
  const sameMonth = start.getUTCMonth() === weekEnd.getUTCMonth();
  const left = sameMonth
    ? `${start.getUTCDate()}`
    : `${start.getUTCDate()} ${month.format(start)}`;
  return `${left}–${weekEnd.getUTCDate()} ${month.format(weekEnd)} ${weekEnd.getUTCFullYear()}`;
}

/**
 * Change over the trailing week, from the equity curve.
 *
 * The series carries since-inception returns, so the week's move is the
 * difference between two points on it — not the last point, which is the whole
 * run. Returns null when there is no point at least a week old to compare
 * against, because a "this week" figure computed from four days of a new book
 * is a different claim than the one the label makes.
 */
export function weekChangePct(series: PerformancePoint[]): number | null {
  const points = series.filter(
    (p): p is { date: string; return_pct: number } =>
      typeof p.date === "string" && typeof p.return_pct === "number",
  );
  if (points.length < 2) return null;

  const latest = points[points.length - 1];
  const cutoff = new Date(latest.date);
  cutoff.setDate(cutoff.getDate() - 7);

  // The last point at or before the cutoff — the book as it stood a week ago.
  let prior: { date: string; return_pct: number } | null = null;
  for (const p of points) {
    if (new Date(p.date) <= cutoff) prior = p;
    else break;
  }
  if (!prior) return null;

  // Both numbers are since-inception percentages off the same base, so the
  // difference of the two multiples is the week's return on that base.
  const a = 1 + prior.return_pct / 100;
  const b = 1 + latest.return_pct / 100;
  if (a <= 0) return null;
  return (b / a - 1) * 100;
}

/** Trades in the seven days ending `weekEnd`, newest first. */
export function movesInWeek(trades: ApiTrade[], weekEnd: Date): WeeklyMove[] {
  const start = new Date(weekEnd);
  start.setDate(start.getDate() - 6);

  return trades
    .filter((t) => {
      if (!t.date || !t.ticker) return false;
      const d = new Date(t.date);
      return d >= start && d <= weekEnd;
    })
    .map((t) => ({
      ticker: t.ticker!.toUpperCase(),
      // Reader-facing words. The internal action vocabulary (conviction_add,
      // recycle, winners_circle_trim) describes machinery a subscriber has no
      // reason to decode, and leaking it has bitten this codebase before.
      action: t.side === "sell" ? "Sold" : "Bought",
      when: new Intl.DateTimeFormat("en-GB", {
        weekday: "short",
        day: "numeric",
        month: "short",
        timeZone: "UTC",
      }).format(new Date(t.date!)),
    }));
}
