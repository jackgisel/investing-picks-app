/**
 * Research note types, safe to import from client components.
 *
 * This module used to statically import all eight article modules, which meant
 * any `"use client"` file that touched it shipped every article body in that
 * page's bundle — the whole reason a generated metadata mirror
 * (lib/insight-index.ts) had to exist alongside it. Insights are database rows
 * now, so there is nothing to import and no mirror to keep in sync: this file
 * holds types only, and `lib/insights-db.ts` holds the queries.
 */

export type InsightPostType = "pick" | "quarterly_review";

/**
 * `pending` — the row exists because a pick does, but has no body yet.
 * `draft`   — Claude wrote one; awaiting review.
 * `failed`  — generation errored; see `generationError`.
 * `approved`— published and announced. Terminal.
 */
export type InsightStatus = "pending" | "draft" | "failed" | "approved";

export const INSIGHT_STATUSES: readonly InsightStatus[] = [
  "pending",
  "draft",
  "failed",
  "approved",
] as const;

/** Everything a card or a link needs. No article body — see `Insight`. */
export type InsightMeta = {
  id: string;
  slug: string;
  ticker: string | null;
  postType: InsightPostType;
  status: InsightStatus;
  title: string | null;
  description: string | null;
  readingTime: number | null;
  tags: string[];
  author: string | null;
  quarter: string | null;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

/** A full note, as rendered. */
export type Insight = InsightMeta & {
  lede: string | null;
  tldr: string[];
  bodyMd: string | null;
  keyTakeaway: string | null;
  generationError: string | null;
  emailSentAt: string | null;
};

/** The shape the model returns, and the shape the editor writes back. */
export type InsightDraftFields = {
  title: string;
  description: string;
  lede: string;
  tldr: string[];
  bodyMd: string;
  keyTakeaway: string;
  tags: string[];
  readingTime: number;
};

/** Only an approved note is visible to a member. */
export function isPublished(insight: Pick<InsightMeta, "status">): boolean {
  return insight.status === "approved";
}

/**
 * The note covering a ticker, from a list already fetched.
 *
 * These used to read a generated module compiled into the bundle; they take
 * the list as an argument now because the data arrives over the wire. Keeping
 * them pure is deliberate — the matching rules (case-insensitive, picks only,
 * null-tolerant for the anonymised payload served to non-subscribers) are
 * worth testing without a database or a fetch.
 */
export function insightForTicker(
  list: readonly InsightMeta[],
  ticker: string | null | undefined,
): InsightMeta | undefined {
  if (!ticker) return undefined;
  const upper = ticker.toUpperCase();
  return list.find(
    (i) => i.postType === "pick" && i.ticker?.toUpperCase() === upper,
  );
}

/** Notes covering any of these tickers, in the order the list arrived. */
export function insightsForTickers(
  list: readonly InsightMeta[],
  tickers: readonly (string | null | undefined)[],
): InsightMeta[] {
  const wanted = new Set(
    tickers.filter((t): t is string => Boolean(t)).map((t) => t.toUpperCase()),
  );
  return list.filter(
    (i) => i.ticker !== null && wanted.has(i.ticker.toUpperCase()),
  );
}

/**
 * Slug for a pick note: `<ticker>-<kebab-title>`, matching the shape of the
 * eight hand-authored notes.
 *
 * Only ever used for a NEW note. The migrated ones carry their original slugs
 * verbatim, because `post_comment` addresses threads by slug and regenerating
 * them would orphan every existing comment.
 */
export function pickSlug(ticker: string, title: string): string {
  const tail = title
    .toLowerCase()
    .replace(/['’‘]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .split("-")
    .filter(Boolean)
    .slice(0, 8)
    .join("-");
  const head = ticker.toLowerCase();
  return tail ? `${head}-${tail}` : head;
}
