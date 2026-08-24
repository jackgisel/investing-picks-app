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

export type InsightPostType =
  | "pick"
  | "quarterly_review"
  | "weekly_review"
  /** The other half of a pick: the position closed, and why. */
  | "exit";

/**
 * `pending` — the row exists because a pick does, but has no body yet.
 * `draft`   — Claude wrote one. Pick notes publish themselves once
 *             `autoPublishAt` passes unless an admin rejects them first; see
 *             `lib/insight-auto-publish`. Weekly reviews stay in `draft` until
 *             an admin confirms AND the Friday noon send fires.
 * `failed`  — generation errored; see `generationError`.
 * `approved`— published and announced. Terminal.
 * `rejected`— an admin stopped it. Terminal for the auto-publisher and the
 *             Friday send; regenerating moves it back to `draft`.
 */
export type InsightStatus =
  | "pending"
  | "draft"
  | "failed"
  | "approved"
  | "rejected";

export const INSIGHT_STATUSES: readonly InsightStatus[] = [
  "pending",
  "draft",
  "failed",
  "approved",
  "rejected",
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
  /**
   * When the auto-publisher will announce this draft. Null on rows that are not
   * awaiting a window (pending, failed, rejected, already approved). Shown in
   * the ops queue so the deadline is never a surprise. On a weekly review this
   * is Friday noon PT, and the send still requires `confirmedAt`.
   */
  autoPublishAt: string | null;
  /**
   * When an admin armed the Friday send. Null until then. Confirm does not
   * publish — status stays `draft` so members cannot see the note.
   */
  confirmedAt: string | null;
  /**
   * Set when this note is the public specimen for its post type — served
   * unauthenticated at /research/<slug> and linked from the landing page. At
   * most one pick note and one exit note carry it.
   */
  publicSampleAt: string | null;
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

/** Badge copy on the Insights index and the article header. */
export function insightCategoryLabel(
  meta: Pick<InsightMeta, "postType" | "ticker">,
): string {
  if (meta.postType === "quarterly_review") return "Quarterly review";
  if (meta.postType === "weekly_review") return "Weekly review";
  if (meta.postType === "exit") {
    return meta.ticker ? `Exit · ${meta.ticker}` : "Exit";
  }
  return meta.ticker ? `Pick · ${meta.ticker}` : "Pick";
}

/**
 * Slug for a weekly review: `weekly-review-2026-w34`.
 *
 * Derived from the ISO week key, not the generated title, so a regenerate
 * cannot change the URL and a second Friday job can find the same row.
 */
export function weeklyReviewSlug(weekKey: string): string {
  return `weekly-review-${weekKey.toLowerCase()}`;
}

/**
 * Slug for an exit note: `exit-avgo-2026-08-14`.
 *
 * Keyed on ticker + exit date rather than the title, for the same reason the
 * weekly slug is keyed on the week: a regenerate must not move the URL, and the
 * sync has to be able to ask "does this round trip already have a note?"
 * without guessing. The date also makes re-entry safe — buying a name back and
 * selling it again is a different note, not a collision.
 */
export function exitSlug(ticker: string, exitDate: string): string {
  return `exit-${ticker.toLowerCase()}-${exitDate.slice(0, 10)}`;
}

/**
 * The exit date back out of an exit slug, or null if it does not carry one.
 *
 * The slug is the stable key for an exit note — it is set at row creation and
 * never moves — so it is also the only place the sweep can recover which round
 * trip a pending row belongs to without a column of its own.
 */
export function exitDateFromSlug(slug: string): string | null {
  const m = /-(\d{4}-\d{2}-\d{2})$/.exec(slug);
  return m ? m[1] : null;
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
