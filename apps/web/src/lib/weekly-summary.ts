import type { WeeklyMove } from "@/lib/email-templates";

/**
 * Arithmetic shared by the Friday weekly review.
 *
 * The Sunday stats digest that used these numbers is gone. The helpers stay
 * because the written review still needs a period label and reader-facing
 * moves — percentages only, same rule as every published surface.
 */

type ApiTrade = {
  ticker?: string | null;
  side?: string | null;
  action?: string | null;
  date?: string | null;
};

/** "August 3–9, 2026" — the week the review covers (American month-first). */
export function periodLabel(weekEnd: Date): string {
  const start = new Date(weekEnd);
  start.setDate(start.getDate() - 6);
  const month = new Intl.DateTimeFormat("en-US", {
    month: "long",
    timeZone: "UTC",
  });
  const sameMonth = start.getUTCMonth() === weekEnd.getUTCMonth();
  if (sameMonth) {
    return `${month.format(weekEnd)} ${start.getUTCDate()}–${weekEnd.getUTCDate()}, ${weekEnd.getUTCFullYear()}`;
  }
  return `${month.format(start)} ${start.getUTCDate()}–${month.format(weekEnd)} ${weekEnd.getUTCDate()}, ${weekEnd.getUTCFullYear()}`;
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
      // Reader-facing words. The internal action vocabulary (double_buy,
      // recycle, winners_circle_trim) describes machinery a subscriber has no
      // reason to decode, and leaking it has bitten this codebase before.
      action:
        t.action === "double_buy"
          ? "Added to"
          : t.side === "sell"
            ? "Sold"
            : "Bought",
      when: new Intl.DateTimeFormat("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
        timeZone: "UTC",
      }).format(new Date(t.date!)),
    }));
}
