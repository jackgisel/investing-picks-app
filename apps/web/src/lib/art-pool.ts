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
