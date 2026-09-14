/**
 * First-class sections of the Sunday Market Preview (the free Market Note).
 *
 * The mailed body is still markdown — `composeMarketNoteBodyMd` is how the four
 * fields become that body — so the send pipeline does not need a second
 * renderer. Old issues that only have `body_md` still send as they always did.
 */

export type MarketNoteWatchItem = {
  ticker: string;
  name: string | null;
  note: string;
};

export type MarketNoteUpcomingDate = {
  date: string;
  label: string;
};

export const MARKET_NOTE_WATCHLIST_SLOTS = 3;

const EMPTY_WATCH: MarketNoteWatchItem = {
  ticker: "",
  name: null,
  note: "",
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function str(value: unknown): string {
  return typeof value === "string" ? value : "";
}

export function emptyWatchlist(): MarketNoteWatchItem[] {
  return Array.from({ length: MARKET_NOTE_WATCHLIST_SLOTS }, () => ({
    ...EMPTY_WATCH,
  }));
}

export function normalizeWatchlist(raw: unknown): MarketNoteWatchItem[] {
  const source = Array.isArray(raw) ? raw : [];
  const items: MarketNoteWatchItem[] = [];
  for (const entry of source) {
    if (items.length >= MARKET_NOTE_WATCHLIST_SLOTS) break;
    const rec = asRecord(entry);
    const ticker = str(rec?.ticker).trim().toUpperCase();
    if (!ticker && !str(rec?.note).trim() && !str(rec?.name).trim()) continue;
    items.push({
      ticker,
      name: str(rec?.name).trim() || null,
      note: str(rec?.note).trim(),
    });
  }
  while (items.length < MARKET_NOTE_WATCHLIST_SLOTS) {
    items.push({ ...EMPTY_WATCH });
  }
  return items;
}

export function filledWatchlist(items: MarketNoteWatchItem[]): MarketNoteWatchItem[] {
  return items.filter((item) => item.ticker.trim());
}

export function normalizeDates(raw: unknown): MarketNoteUpcomingDate[] {
  if (!Array.isArray(raw)) return [];
  const dates: MarketNoteUpcomingDate[] = [];
  for (const entry of raw) {
    const rec = asRecord(entry);
    const date = str(rec?.date).trim();
    const label = str(rec?.label).trim();
    if (!date && !label) continue;
    dates.push({ date, label });
  }
  return dates;
}

export function composeMarketNoteBodyMd(args: {
  watchlist: MarketNoteWatchItem[];
  sectorsMd: string | null | undefined;
  sentimentMd: string | null | undefined;
  dates: MarketNoteUpcomingDate[];
}): string | null {
  const sections: string[] = [];
  const stocks = filledWatchlist(args.watchlist);
  if (stocks.length > 0) {
    const lines = stocks.map((stock) => {
      const name = stock.name ? `, ${stock.name}` : "";
      const note = stock.note ? ` — ${stock.note}` : "";
      return `- **${stock.ticker}**${name}${note}`;
    });
    sections.push(`## Looking at\n\n${lines.join("\n")}`);
  }

  const sectors = args.sectorsMd?.trim();
  if (sectors) {
    sections.push(`## Where sectors are moving\n\n${sectors}`);
  }

  const sentiment = args.sentimentMd?.trim();
  if (sentiment) {
    sections.push(`## Fears and excitements\n\n${sentiment}`);
  }

  const dates = args.dates.filter((d) => d.date.trim() || d.label.trim());
  if (dates.length > 0) {
    const lines = dates.map((d) => {
      const when = d.date.trim() || "TBD";
      const label = d.label.trim() || "On the calendar";
      return `- **${when}** — ${label}`;
    });
    sections.push(`## Dates ahead\n\n${lines.join("\n")}`);
  }

  return sections.length > 0 ? sections.join("\n\n") : null;
}

export function hasMarketNotePreviewContent(args: {
  watchlist: MarketNoteWatchItem[];
  sectorsMd: string | null | undefined;
  sentimentMd: string | null | undefined;
  dates: MarketNoteUpcomingDate[];
  bodyMd?: string | null;
}): boolean {
  return Boolean(
    composeMarketNoteBodyMd(args) || args.bodyMd?.trim(),
  );
}
