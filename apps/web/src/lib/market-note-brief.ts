import { OPS_API_BASE } from "@/lib/api-config";

type EditorialBrief = {
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

/** A reviewable draft block, never an automatic send. */
export async function draftMarketNoteBrief(): Promise<{ lede: string; bodyMd: string }> {
  const key = process.env.OPS_API_KEY;
  if (!key) throw new Error("OPS_API_KEY is not configured");
  const res = await fetch(`${OPS_API_BASE}/editorial-brief`, {
    headers: { "X-Ops-Key": key },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Editorial brief request failed (${res.status})`);
  const brief = (await res.json()) as EditorialBrief;
  if (!brief.rating_as_of) throw new Error("The scoring system has no current snapshot");

  const sectorLines = brief.sectors.map((sector) => {
    const change = sector.high_rating_change === null
      ? "no 7-day comparison"
      : `${sector.high_rating_change >= 0 ? "+" : ""}${sector.high_rating_change} names above the rating threshold in 7 days`;
    return `- **${sector.sector}**: ${sector.qualified_companies} of ${sector.rated_companies} companies pass the full current screen (${sector.qualified_share_pct}%). ${change}.`;
  });
  const watchlistLines = brief.watchlist.map((stock) => {
    const change = stock.rating_change === null
      ? "No 7-day rating comparison."
      : `Rating change: ${stock.rating_change >= 0 ? "+" : ""}${stock.rating_change.toFixed(2)} over 7 days.`;
    const growth = stock.fundamentals?.revenue_growth_ttm_pct;
    const revisions = stock.fundamentals?.revenue_revision_pct;
    const fundamentals = [
      growth === null || growth === undefined ? null : `Revenue growth ${growth >= 0 ? "+" : ""}${growth.toFixed(1)}%`,
      revisions === null || revisions === undefined ? null : `revenue revisions ${revisions >= 0 ? "+" : ""}${revisions.toFixed(1)}%`,
    ].filter(Boolean).join(". ");
    return `- **${stock.ticker}**${stock.name ? `, ${stock.name}` : ""} (${stock.sector ?? "sector unavailable"}) — ${stock.quant_rating.toFixed(2)} / 5. ${fundamentals ? `${fundamentals}. ` : ""}${change}`;
  });

  return {
    lede: `The latest model screen is dated ${brief.rating_as_of}. Here is where its breadth is building, and three highly rated names outside the current book.`,
    bodyMd: `## Where the screen is broadening\n\n${sectorLines.join("\n")}\n\n## Model watchlist\n\n${watchlistLines.join("\n")}\n\nThese are not portfolio picks or recommendations. They are the highest-rated names outside the current book at the time of the screen. A name can still fail another buy gate, run into a sector limit, or never enter the portfolio.`,
  };
}
