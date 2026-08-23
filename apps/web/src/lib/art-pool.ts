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
import { ART, artForKey } from "@/lib/art";
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

/** Unassigned covers for future blog posts. Mark claimed in SPARE_CLAIMED. */
export const SPARE_POOL: readonly string[] = [
  "spare-01",
  "spare-02",
  "spare-03",
  "spare-04",
  "spare-05",
  "spare-06",
] as const;

/**
 * Spares already assigned to a blog slug. Update this when you claim one so
 * `nextSpareCover()` skips it.
 */
export const SPARE_CLAIMED: Readonly<Record<string, string>> = {
  // "spare-01": "some-future-slug",
};

function poolPiece(id: string, label: string): ArtPiece {
  return {
    id,
    src: `/art/pool/${id}.png`,
    label,
    ink: ART[0].ink,
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
  for (const id of SPARE_POOL) {
    if (!SPARE_CLAIMED[id]) {
      return { id, src: `/art/pool/${id}.png` };
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
  const sparesFree = SPARE_POOL.filter((id) => !SPARE_CLAIMED[id]).length;
  return {
    weeksReady: WEEKLY_POOL.length,
    weeksRemaining,
    sparesFree,
  };
}
