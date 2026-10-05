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
