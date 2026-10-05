import data from "./themes.json";

/**
 * Who gets an X graphic. A curated list, not a sector match: FMP's Technology
 * bucket is too wide, and the power and cooling names sit in Industrials and
 * Utilities. Adding a name is a line in themes.json. The worker reads the
 * same file so a smaller name on the list is still ingested.
 */

export const THEMES: Record<string, readonly string[]> = data.themes;

const byTicker = new Map<string, string>();
for (const [theme, tickers] of Object.entries(THEMES)) {
  for (const ticker of tickers) byTicker.set(ticker, theme);
}

export function themeOf(ticker: string): string | null {
  return byTicker.get(ticker.trim().toUpperCase()) ?? null;
}

export function themeTickers(): string[] {
  return [...byTicker.keys()];
}
