/**
 * Pre-generated dithered art for upcoming weeks and future blog posts.
 *
 * Weekly keys match `isoWeekKey()` (`2026-W35`). When a week has a pool file,
 * emails and surfaces for that week use it instead of hashing the shared ART
 * set. Spare slots are claimed manually when authoring a blog post
 * (`nextSpareCover()`).
 *
 * Pool files live in /public/art/pool/. After claiming a spare for a blog
 * post, copy it to /art/covers/{slug}.png and set meta.cover — then add the
 * spare id to SPARE_CLAIMED so it is not suggested again.
 */

import type { ArtPiece } from "@/lib/art";
import { ART, ART_COVER_WIDTH, ART_SPARE_WIDTH, artForKey } from "@/lib/art";
import { isoWeekKey } from "@/lib/email-dispatch";

/** ISO weeks with a dedicated landscape ready (Aug 24 – Nov 22, 2026). */
export const WEEKLY_POOL: readonly string[] = [
  "2026-W35",
  "2026-W36",
  "2026-W37",
  "2026-W38",
  "2026-W39",
  "2026-W40",
  "2026-W41",
  "2026-W42",
  "2026-W43",
  "2026-W44",
  "2026-W45",
  "2026-W46",
  "2026-W47",
] as const;

function sparePiece(id: string, label: string, ink: string, width = ART_COVER_WIDTH): ArtPiece {
  return {
    id,
    src: `/art/pool/${id}.png`,
    label,
    ink,
    width,
  };
}

/**
 * Unassigned covers for future blog posts. Mark claimed in SPARE_CLAIMED.
 * Each slot carries a short scene label and the ink used on cream paper.
 */
export const SPARE_POOL: readonly ArtPiece[] = [
  sparePiece("spare-01", "Night observatory", "#2F5A8C"),
  sparePiece("spare-02", "Canal windmills", "#0D5C26"),
  sparePiece("spare-03", "Forest trestle", "#0C54C7"),
  sparePiece("spare-04", "Palm house", "#084216"),
  sparePiece("spare-05", "Coastal amphitheatre", "#196BAD"),
  sparePiece("spare-06", "Mountain hot springs", "#0B546C"),
  sparePiece("spare-07", "Lighthouse", "#1E3A8A", ART_SPARE_WIDTH),
  sparePiece("spare-08", "Mesa", "#0F5C5C", ART_SPARE_WIDTH),
  sparePiece("spare-09", "Harbor boats", "#1B4D3E", ART_SPARE_WIDTH),
  sparePiece("spare-10", "Alpine lake", "#9B2331", ART_SPARE_WIDTH),
  sparePiece("spare-11", "Hill town", "#6B4423", ART_SPARE_WIDTH),
  sparePiece("spare-12", "Terraces", "#3E6B58", ART_SPARE_WIDTH),
  sparePiece("spare-13", "Cypress coast", "#146C32", ART_SPARE_WIDTH),
  sparePiece("spare-14", "Wheat hills", "#A67C2D", ART_SPARE_WIDTH),
  sparePiece("spare-15", "Slot canyon", "#C23B32", ART_SPARE_WIDTH),
  sparePiece("spare-16", "Lavender hills", "#5C3D8A", ART_SPARE_WIDTH),
  sparePiece("spare-17", "Glacier", "#1A6E82", ART_SPARE_WIDTH),
  sparePiece("spare-18", "Adobe pueblo", "#C46A32", ART_SPARE_WIDTH),
  sparePiece("spare-19", "Grand Canyon", "#5A2916", ART_SPARE_WIDTH),
  sparePiece("spare-20", "Half Dome", "#194569", ART_SPARE_WIDTH),
  sparePiece("spare-21", "Golden Gate", "#4F3322", ART_SPARE_WIDTH),
  sparePiece("spare-22", "Manhattan", "#245094", ART_SPARE_WIDTH),
  sparePiece("spare-23", "Delicate Arch", "#8D552A", ART_SPARE_WIDTH),
  sparePiece("spare-24", "Mount Rainier", "#318784", ART_SPARE_WIDTH),
  sparePiece("spare-25", "Florida Keys", "#249480", ART_SPARE_WIDTH),
  sparePiece("spare-26", "Chicago lakefront", "#223F4F", ART_SPARE_WIDTH),
  sparePiece("spare-27", "Grand Prismatic", "#2C7A5E", ART_SPARE_WIDTH),
  sparePiece("spare-28", "Zion", "#77311D", ART_SPARE_WIDTH),
  sparePiece("spare-29", "Acadia", "#27356D", ART_SPARE_WIDTH),
  sparePiece("spare-30", "White Sands", "#816837", ART_SPARE_WIDTH),
  sparePiece("spare-31", "Redwoods", "#249454", ART_SPARE_WIDTH),
  sparePiece("spare-32", "Bryce Canyon", "#814437", ART_SPARE_WIDTH),
  sparePiece("spare-33", "Grand Tetons", "#22294F", ART_SPARE_WIDTH),
  sparePiece("spare-34", "Smoky Mountains", "#26802E", ART_SPARE_WIDTH),
  sparePiece("spare-35", "Niagara Falls", "#165A3B", ART_SPARE_WIDTH),
  sparePiece("spare-36", "Fitz Roy", "#602244", ART_SPARE_WIDTH),
  sparePiece("spare-37", "Matterhorn", "#242F94", ART_SPARE_WIDTH),
  sparePiece("spare-38", "Santorini", "#1A1A56", ART_SPARE_WIDTH),
  sparePiece("spare-39", "Kyoto bamboo", "#2B9424", ART_SPARE_WIDTH),
  sparePiece("spare-40", "Petra", "#944124", ART_SPARE_WIDTH),
  sparePiece("spare-41", "Black sand beach", "#1D1969", ART_SPARE_WIDTH),
  sparePiece("spare-42", "Machu Picchu", "#4B8026", ART_SPARE_WIDTH),
  sparePiece("spare-43", "Norwegian fjord", "#318759", ART_SPARE_WIDTH),
  sparePiece("spare-44", "Cappadocia", "#4F4122", ART_SPARE_WIDTH),
  sparePiece("spare-45", "Sahara", "#856B20", ART_SPARE_WIDTH),
  sparePiece("spare-46", "Great Wall", "#5E7432", ART_SPARE_WIDTH),
  sparePiece("spare-47", "Ha Long Bay", "#345A16", ART_SPARE_WIDTH),
  sparePiece("spare-48", "Uluru", "#4F2222", ART_SPARE_WIDTH),
  sparePiece("spare-49", "Mont-Saint-Michel", "#462085", ART_SPARE_WIDTH),
  sparePiece("spare-50", "Salt flats", "#3D1A56", ART_SPARE_WIDTH),
  sparePiece("spare-51", "Angkor Wat", "#8D862A", ART_SPARE_WIDTH),
  sparePiece("spare-52", "Table Mountain", "#579424", ART_SPARE_WIDTH),
  sparePiece("spare-53", "Ringed planet", "#762A8D", ART_SPARE_WIDTH),
  sparePiece("spare-54", "Lunar base", "#6B2272", ART_SPARE_WIDTH),
  sparePiece("spare-55", "Mars dunes", "#691920", ART_SPARE_WIDTH),
  sparePiece("spare-56", "Nebula", "#4F224E", ART_SPARE_WIDTH),
  sparePiece("spare-57", "Ocean world", "#94248A", ART_SPARE_WIDTH),
  sparePiece("spare-58", "Deco city", "#5A5216", ART_SPARE_WIDTH),
  sparePiece("spare-59", "Orbital station", "#743269", ART_SPARE_WIDTH),
  sparePiece("spare-60", "Alien aurora", "#789424", ART_SPARE_WIDTH),
  sparePiece("spare-61", "Ice geysers", "#64771D", ART_SPARE_WIDTH),
  sparePiece("spare-62", "Twin suns", "#747032", ART_SPARE_WIDTH),
  sparePiece("spare-63", "Crystal canyon", "#8D2A74", ART_SPARE_WIDTH),
  sparePiece("spare-64", "Sky islands", "#7A2C3C", ART_SPARE_WIDTH),
  sparePiece("spare-65", "Terminator city", "#802659", ART_SPARE_WIDTH),
  sparePiece("spare-66", "Asteroid", "#464F22", ART_SPARE_WIDTH),
  sparePiece("spare-67", "Night forest", "#942453", ART_SPARE_WIDTH),
  sparePiece("spare-68", "Titan lakes", "#4F2233", ART_SPARE_WIDTH),
] as const;

/**
 * Spares already assigned to a blog slug. Update this when you claim one so
 * `nextSpareCover()` skips it.
 */
export const SPARE_CLAIMED: Readonly<Record<string, string>> = {
  "spare-01": "when-to-sell-a-stock-thesis-broken",
  "spare-02": "sp-500-concentration-risk-what-index-investors-miss",
  "spare-03": "how-to-read-a-stock-research-thesis",
  "spare-04": "what-good-stock-research-looks-like",
  "spare-05": "value-investing-more-than-cheap-stocks",
  "spare-06": "anthropic-ipo-valuation-outpick-screen",
  "spare-07": "individual-stock-research-that-still-holds-up",
  "spare-08": "earnings-revision-investing",
  "spare-09": "market-cycle-analysis-stock-investors",
  "spare-10": "is-a-stock-research-membership-worth-it",
  "spare-11": "investment-thesis-template",
  "spare-12": "sector-relative-performance",
  "spare-13": "how-to-calculate-intrinsic-value",
  "spare-14": "how-to-analyze-competitive-advantage",
  "spare-15": "free-cash-flow-stock-analysis",
};

function poolPiece(id: string, label: string): ArtPiece {
  return {
    id,
    src: `/art/pool/${id}.png`,
    label,
    ink: ART[0].ink,
    width: ART_COVER_WIDTH,
  };
}

/** Art for an ISO week key (`2026-W35`). Falls back to the shared hash pool. */
export function artForWeek(weekKey: string): ArtPiece {
  const normalized = normalizeWeekKey(weekKey);
  if (normalized && (WEEKLY_POOL as readonly string[]).includes(normalized)) {
    return poolPiece(normalized, `Weekly art for ${normalized}`);
  }
  return artForKey(weekKey);
}

/**
 * Same print the pick / weekly-review email used for this note.
 *
 * Weekly reviews carry the week in the slug. Pick, add, and exit notes use
 * the week they were published (or created, for a draft still in review),
 * which is the key `sendNewPickEmail` stamps at send time.
 */
export function artForInsight(insight: {
  slug: string;
  publishedAt: string | null;
  createdAt: string;
}): ArtPiece {
  const fromSlug = weekKeyFromInsightSlug(insight.slug);
  if (fromSlug) return artForWeek(fromSlug);
  return artForWeek(isoWeekKey(new Date(insight.publishedAt ?? insight.createdAt)));
}

/** Normalize `2026-w35` / `2026-W35` → `2026-W35`. */
export function normalizeWeekKey(weekKey: string): string | null {
  const m = /^(\d{4})-[wW](\d{1,2})$/.exec(weekKey.trim());
  if (!m) return null;
  return `${m[1]}-W${m[2].padStart(2, "0")}`;
}

/**
 * Pull week key from a weekly-review insight slug (`weekly-review-2026-w35`).
 * Returns null when the slug is not a review.
 */
export function weekKeyFromInsightSlug(slug: string): string | null {
  const m = /^weekly-review-(\d{4}-[wW]\d{1,2})$/.exec(slug);
  if (!m) return null;
  return normalizeWeekKey(m[1]);
}

/** Next unclaimed spare for a new blog post, or null if the pool is empty. */
export function nextSpareCover(): { id: string; src: string } | null {
  for (const spare of SPARE_POOL) {
    if (!SPARE_CLAIMED[spare.id]) {
      return { id: spare.id, src: spare.src };
    }
  }
  return null;
}

/** Snapshot of how much pre-generated art remains. */
export function poolStatus(now: Date = new Date()): {
  weeksReady: number;
  weeksRemaining: number;
  sparesFree: number;
} {
  const current = isoWeekKey(now);
  const weeksRemaining = WEEKLY_POOL.filter((w) => w >= current).length;
  const sparesFree = SPARE_POOL.filter((spare) => !SPARE_CLAIMED[spare.id]).length;
  return {
    weeksReady: WEEKLY_POOL.length,
    weeksRemaining,
    sparesFree,
  };
}
