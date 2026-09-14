import { OPS_API_BASE } from "@/lib/api-config";
import {
  composeMarketNoteBodyMd,
  normalizeDates,
  normalizeWatchlist,
  type MarketNoteUpcomingDate,
  type MarketNoteWatchItem,
} from "@/lib/market-note-preview";

export type EditorialBrief = {
  rating_as_of: string | null;
  sectors: {
    sector: string;
    rated_companies: number;
    qualified_companies: number;
    qualified_share_pct: number;
    high_rating_change: number | null;
  }[];
  watchlist: {
    ticker: string;
    name: string | null;
    sector: string | null;
    market_cap: number | null;
    quant_rating: number;
    rating_change: number | null;
    grades: Record<string, string>;
    fundamentals: {
      revenue_growth_ttm_pct: number | null;
      revenue_revision_pct: number | null;
      earnings_report_date: string | null;
    } | null;
  }[];
};

export type MarketNotePreviewDraft = {
  lede: string;
  watchlist: MarketNoteWatchItem[];
  sectorsMd: string;
  sentimentMd: string;
  dates: MarketNoteUpcomingDate[];
  /** Composed markdown, kept so the send pipeline can stay on `body_md`. */
  bodyMd: string;
};

function watchNote(stock: EditorialBrief["watchlist"][number]): string {
  const bits: string[] = [`${stock.quant_rating.toFixed(2)} / 5`];
  if (stock.sector) bits[0] += ` · ${stock.sector}`;
  const growth = stock.fundamentals?.revenue_growth_ttm_pct;
  const revisions = stock.fundamentals?.revenue_revision_pct;
  if (growth !== null && growth !== undefined) {
    bits.push(`Revenue growth ${growth >= 0 ? "+" : ""}${growth.toFixed(1)}%`);
  }
  if (revisions !== null && revisions !== undefined) {
    bits.push(
      `revenue revisions ${revisions >= 0 ? "+" : ""}${revisions.toFixed(1)}%`,
    );
  }
  if (stock.rating_change === null) {
    bits.push("No 7-day rating comparison.");
  } else {
    bits.push(
      `Rating ${stock.rating_change >= 0 ? "+" : ""}${stock.rating_change.toFixed(2)} over 7 days.`,
    );
  }
  return bits.join(". ");
}

function sectorsMarkdown(sectors: EditorialBrief["sectors"]): string {
  return sectors
    .map((sector) => {
      const change =
        sector.high_rating_change === null
          ? "no 7-day comparison"
          : `${sector.high_rating_change >= 0 ? "+" : ""}${sector.high_rating_change} names above the rating threshold in 7 days`;
      return `- **${sector.sector}**: ${sector.qualified_companies} of ${sector.rated_companies} companies pass the full current screen (${sector.qualified_share_pct}%). ${change}.`;
    })
    .join("\n");
}

function sentimentFromSectors(sectors: EditorialBrief["sectors"]): string {
  const rising = sectors.filter((s) => (s.high_rating_change ?? 0) > 0);
  const falling = sectors.filter((s) => (s.high_rating_change ?? 0) < 0);
  const excitement =
    rising.length > 0
      ? `Breadth is building in ${rising.map((s) => s.sector).join(", ")} — more names are clearing the screen than a week ago.`
      : "No sector is adding names above the rating threshold this week, so the excitement is not a broadening screen.";
  const fear =
    falling.length > 0
      ? `The fear is ${falling.map((s) => s.sector).join(", ")}, where the screen is losing names. A cheaper multiple with rolling estimates is a trap, not a gift.`
      : "Nothing in the sector tape is shrinking in a way that looks like a trap forming. The thing to watch is still revisions, not the de-rating itself.";
  return `${excitement}\n\n${fear}`;
}

function datesFromWatchlist(
  watchlist: EditorialBrief["watchlist"],
): MarketNoteUpcomingDate[] {
  const byDate = new Map<string, string[]>();
  for (const stock of watchlist) {
    const date = stock.fundamentals?.earnings_report_date?.trim();
    if (!date) continue;
    const tickers = byDate.get(date) ?? [];
    tickers.push(stock.ticker);
    byDate.set(date, tickers);
  }
  return [...byDate.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, tickers]) => ({
      date,
      label: `${tickers.join(", ")} earnings`,
    }));
}

/** Turn the scoring snapshot into the four Sunday preview fields. */
export function previewFromEditorialBrief(
  brief: EditorialBrief,
): MarketNotePreviewDraft {
  const watchlist = normalizeWatchlist(
    brief.watchlist.slice(0, 3).map((stock) => ({
      ticker: stock.ticker,
      name: stock.name,
      note: watchNote(stock),
    })),
  );
  const sectorsMd = sectorsMarkdown(brief.sectors);
  const sentimentMd = sentimentFromSectors(brief.sectors);
  const dates = normalizeDates(datesFromWatchlist(brief.watchlist));
  const lede = brief.rating_as_of
    ? `The latest model screen is dated ${brief.rating_as_of}. Here is where its breadth is building, and three highly rated names outside the current book.`
    : "Here is where the screen is building, and three highly rated names outside the current book.";
  const bodyMd =
    composeMarketNoteBodyMd({
      watchlist,
      sectorsMd,
      sentimentMd,
      dates,
    }) ?? "";
  return { lede, watchlist, sectorsMd, sentimentMd, dates, bodyMd };
}

/** A reviewable draft block, never an automatic send. */
export async function draftMarketNoteBrief(): Promise<MarketNotePreviewDraft> {
  const key = process.env.OPS_API_KEY;
  if (!key) throw new Error("OPS_API_KEY is not configured");
  const res = await fetch(`${OPS_API_BASE}/editorial-brief`, {
    headers: { "X-Ops-Key": key },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Editorial brief request failed (${res.status})`);
  const brief = (await res.json()) as EditorialBrief;
  if (!brief.rating_as_of) {
    throw new Error("The scoring system has no current snapshot");
  }
  return previewFromEditorialBrief(brief);
}
