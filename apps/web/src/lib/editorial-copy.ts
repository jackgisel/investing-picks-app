import { oneDecimalPct } from "@/lib/comm-calendar";
import type { BookPosition } from "@/lib/held-tickers";

export function chooseSpotlightHolding(
  positions: BookPosition[],
  lastTicker: string | null,
): BookPosition | null {
  const ranked = positions
    .filter((position) => position.pnlPct !== null)
    .sort((a, b) => (b.pnlPct ?? 0) - (a.pnlPct ?? 0));
  return ranked.find((position) => position.ticker !== lastTicker) ?? ranked[0] ?? null;
}

export function spotlightCopy(args: {
  ticker: string;
  pnlPct: number;
  entryDate: string | null;
  revenuePct: number | null;
}): { subject: string; bodyMd: string } {
  const since = oneDecimalPct(args.pnlPct);
  const when = args.entryDate ? ` on ${args.entryDate}` : "";
  const revenue =
    args.revenuePct === null
      ? "Revenue growth for the latest reported year is not on file yet."
      : `Revenue has grown ${oneDecimalPct(args.revenuePct)} over the latest reported year.`;
  return {
    subject: `${args.ticker} is ${since} since we bought it`,
    bodyMd: `${args.ticker} is ${since} since we bought it${when}.\n\n${revenue}\n\nWhy it is the one to talk about this week:\n`,
  };
}

export function holdingFromPriorCycle(
  positions: BookPosition[],
  previousFriday: string,
): BookPosition | null {
  const dated = positions.filter((position) => position.pnlPct !== null && position.entryDate);
  const onDay = dated
    .filter((position) => position.entryDate === previousFriday)
    .sort((a, b) => (b.pnlPct ?? 0) - (a.pnlPct ?? 0));
  if (onDay[0]) return onDay[0];
  const older = dated
    .filter((position) => (position.entryDate ?? "") <= previousFriday)
    .sort((a, b) => (b.entryDate ?? "").localeCompare(a.entryDate ?? ""));
  return older[0] ?? null;
}

export function pickResultText(
  ticker: string,
  returnPct: number,
  revenuePct: number,
): string {
  return `We picked $${ticker}. It has returned ${oneDecimalPct(returnPct)} since we picked it. Revenue has grown ${oneDecimalPct(revenuePct)}.`;
}
