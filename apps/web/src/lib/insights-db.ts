import { pool } from "@/lib/db";
import { reviewWindowHours } from "@/lib/review-window";
import type {
  Insight,
  InsightDraftFields,
  InsightMeta,
  InsightStatus,
} from "@/lib/insights";

/**
 * Database access for research notes.
 *
 * Split from `lib/insights.ts` for the same reason `comments-db.ts` is split
 * from `comments.ts`: that module carries types the dashboard's client
 * components import, and a `pg` import in the same file drags the driver into
 * the browser bundle and fails the build on `dns`/`net`.
 */

interface DbInsightRow {
  id: string;
  slug: string;
  ticker: string | null;
  post_type: "pick" | "quarterly_review" | "weekly_review";
  status: InsightStatus;
  title: string | null;
  description: string | null;
  lede: string | null;
  tldr: string[] | null;
  body_md: string | null;
  key_takeaway: string | null;
  tags: string[] | null;
  reading_time: number | null;
  author: string | null;
  quarter: string | null;
  generation_error: string | null;
  published_at: Date | null;
  email_sent_at: Date | null;
  auto_publish_at: Date | null;
  confirmed_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

const META_COLUMNS = `id, slug, ticker, post_type, status, title, description,
  reading_time, tags, author, quarter, published_at, auto_publish_at,
  confirmed_at, created_at, updated_at`;

const FULL_COLUMNS = `${META_COLUMNS}, lede, tldr, body_md, key_takeaway,
  generation_error, email_sent_at`;

function toMeta(r: DbInsightRow): InsightMeta {
  return {
    id: String(r.id),
    slug: r.slug,
    ticker: r.ticker,
    postType: r.post_type,
    status: r.status,
    title: r.title,
    description: r.description,
    readingTime: r.reading_time,
    // JSONB comes back as null when never written, not as an empty array.
    tags: r.tags ?? [],
    author: r.author,
    quarter: r.quarter,
    publishedAt: r.published_at ? r.published_at.toISOString() : null,
    autoPublishAt: r.auto_publish_at ? r.auto_publish_at.toISOString() : null,
    confirmedAt: r.confirmed_at ? r.confirmed_at.toISOString() : null,
    createdAt: r.created_at.toISOString(),
    updatedAt: r.updated_at.toISOString(),
  };
}

function toInsight(r: DbInsightRow): Insight {
  return {
    ...toMeta(r),
    lede: r.lede,
    tldr: r.tldr ?? [],
    bodyMd: r.body_md,
    keyTakeaway: r.key_takeaway,
    generationError: r.generation_error,
    emailSentAt: r.email_sent_at ? r.email_sent_at.toISOString() : null,
  };
}

/* ------------------------------- Reading -------------------------------- */

/**
 * Published notes, newest first.
 *
 * `includeUnpublished` is for the ops surface only. Every member-facing caller
 * must leave it off — the filter is here, in the query, so a page that forgets
 * to check `status` cannot leak an unreviewed draft.
 */
export async function listInsights(
  opts: { includeUnpublished?: boolean } = {},
): Promise<InsightMeta[]> {
  const { rows } = await pool.query<DbInsightRow>(
    `SELECT ${META_COLUMNS}
       FROM insight
      ${opts.includeUnpublished ? "" : "WHERE status = 'approved'"}
      ORDER BY COALESCE(published_at, created_at) DESC, ticker ASC`,
  );
  return rows.map(toMeta);
}

export async function getInsightBySlug(
  slug: string,
  opts: { includeUnpublished?: boolean } = {},
): Promise<Insight | null> {
  const { rows } = await pool.query<DbInsightRow>(
    `SELECT ${FULL_COLUMNS}
       FROM insight
      WHERE slug = $1
        ${opts.includeUnpublished ? "" : "AND status = 'approved'"}`,
    [slug],
  );
  return rows[0] ? toInsight(rows[0]) : null;
}

export async function getInsightById(id: string): Promise<Insight | null> {
  const { rows } = await pool.query<DbInsightRow>(
    `SELECT ${FULL_COLUMNS} FROM insight WHERE id = $1`,
    [id],
  );
  return rows[0] ? toInsight(rows[0]) : null;
}

/** The published note covering a ticker, if there is one. */
export async function getInsightByTicker(
  ticker: string | null | undefined,
  opts: { includeUnpublished?: boolean } = {},
): Promise<InsightMeta | null> {
  if (!ticker) return null;
  const { rows } = await pool.query<DbInsightRow>(
    `SELECT ${META_COLUMNS}
       FROM insight
      WHERE post_type = 'pick'
        AND UPPER(ticker) = UPPER($1)
        ${opts.includeUnpublished ? "" : "AND status = 'approved'"}`,
    [ticker],
  );
  return rows[0] ? toMeta(rows[0]) : null;
}

/* ------------------------------- Writing -------------------------------- */

/**
 * Create the placeholder row for a pick that has no note yet.
 *
 * Returns null when one already exists — the unique index on
 * (ticker) WHERE post_type = 'pick' makes this safe to call on a loop, which
 * is what lets the reconciliation sweep be the source of truth rather than a
 * push nobody can prove arrived.
 */
export async function createPendingInsight(
  ticker: string,
  slug: string,
): Promise<InsightMeta | null> {
  const { rows } = await pool.query<DbInsightRow>(
    `INSERT INTO insight (slug, ticker, post_type, status)
     VALUES ($1, UPPER($2), 'pick', 'pending')
     ON CONFLICT DO NOTHING
     RETURNING ${META_COLUMNS}`,
    [slug, ticker],
  );
  return rows[0] ? toMeta(rows[0]) : null;
}

/**
 * How many times the sweep will try to draft one note before giving up.
 *
 * A ticker whose facts genuinely cannot be drafted — the API has no profile for
 * it, the model keeps refusing the schema — must not cost a model call on every
 * sweep forever. Three is enough to ride out a transient upstream failure and
 * cheap enough that a permanent one is not expensive.
 */
export const MAX_GENERATION_ATTEMPTS = 3;

/**
 * Every note still waiting on a body, oldest first.
 *
 * Includes rows that FAILED and still have attempts left. Selecting only
 * `pending` is what left a generation error parked until a human noticed and
 * pressed Regenerate — the same "gate with no doorbell" that left approved
 * notes unsent. `failed` rows come last so a fresh pick is never stuck behind
 * a retry of a broken one.
 */
export async function listPendingInsights(): Promise<InsightMeta[]> {
  const { rows } = await pool.query<DbInsightRow>(
    `SELECT ${META_COLUMNS}
       FROM insight
      WHERE post_type = 'pick'
        AND ticker IS NOT NULL
        AND (
          status = 'pending'
          OR (status = 'failed' AND generation_attempts < $1)
        )
      ORDER BY (status = 'failed'), created_at ASC`,
    [MAX_GENERATION_ATTEMPTS],
  );
  return rows.map(toMeta);
}

/**
 * Store a generated draft. Clears any prior failure.
 *
 * `slug` is set here rather than at row creation because it derives from the
 * generated title, which does not exist until now — the pending row carries a
 * placeholder. It is only ever moved while the note is unpublished: once
 * approved, the slug is the URL subscribers were mailed and the key
 * `post_comment` threads hang off, so changing it breaks both.
 *
 * A slug collision is survivable and silently ignored (the note keeps the one
 * it had). Two notes wanting the same URL is a naming coincidence, not a
 * reason to throw away a draft that just cost a model call.
 *
 * This is also where the auto-publish clock starts. Every path that produces a
 * body goes through here, so stamping `auto_publish_at` in this statement is
 * what guarantees no draft can exist without a deadline — including one that
 * was rejected and then regenerated, which gets a fresh window because the
 * text an admin rejected is no longer the text that would go out.
 *
 * @param windowHours  Hours before the sweep may announce it. Ignored when
 *   `autoPublishAt` is passed — weekly reviews stamp Friday noon PT instead
 *   of a sliding window.
 * @param autoPublishAt  Absolute deadline. Regenerating a weekly review keeps
 *   the same Friday noon rather than pushing the send.
 */
export async function saveDraft(
  id: string,
  fields: InsightDraftFields,
  sourceFacts: unknown,
  slug?: string,
  windowHours: number = reviewWindowHours(),
  autoPublishAt?: Date,
): Promise<Insight | null> {
  const { rows } = await pool.query<DbInsightRow>(
    `UPDATE insight
        SET title = $2, description = $3, lede = $4, tldr = $5::jsonb,
            body_md = $6, key_takeaway = $7, tags = $8::jsonb,
            reading_time = $9, source_facts = $10::jsonb,
            slug = CASE
                     WHEN $11::text IS NULL THEN slug
                     WHEN EXISTS (
                       SELECT 1 FROM insight o
                        WHERE o.slug = $11::text AND o.id <> insight.id
                     ) THEN slug
                     ELSE $11::text
                   END,
            status = 'draft', generation_error = NULL, updated_at = NOW(),
            -- Reset on success: the retry budget is three CONSECUTIVE
            -- failures, so a note that eventually drafts starts clean if it is
            -- ever regenerated later.
            generation_attempts = 0,
            auto_publish_at = COALESCE(
              $13::timestamptz,
              NOW() + ($12::numeric * INTERVAL '1 hour')
            ),
            -- Regenerating disarms a Friday confirm. Edits through
            -- updateInsightFields do not.
            confirmed_at = NULL
      WHERE id = $1
        -- An approved note is immutable through this path. Regenerating one
        -- would silently rewrite something subscribers were already mailed.
        AND status <> 'approved'
      RETURNING ${FULL_COLUMNS}`,
    [
      id,
      fields.title,
      fields.description,
      fields.lede,
      JSON.stringify(fields.tldr),
      fields.bodyMd,
      fields.keyTakeaway,
      JSON.stringify(fields.tags),
      fields.readingTime,
      JSON.stringify(sourceFacts ?? null),
      slug ?? null,
      windowHours,
      autoPublishAt ?? null,
    ],
  );
  return rows[0] ? toInsight(rows[0]) : null;
}

/**
 * Record a generation failure so the row never sits wedged in `pending`.
 *
 * Increments the attempt counter, which is what eventually stops the sweep
 * retrying a note that cannot be drafted. A successful `saveDraft` resets it,
 * so the budget is three consecutive failures rather than three ever.
 */
export async function markGenerationFailed(
  id: string,
  message: string,
): Promise<void> {
  await pool.query(
    `UPDATE insight
        SET status = 'failed',
            generation_error = $2,
            generation_attempts = generation_attempts + 1,
            updated_at = NOW()
      WHERE id = $1 AND status <> 'approved'`,
    [id, message.slice(0, 2000)],
  );
}

/** Admin edits. Only the authored fields; status is moved by its own calls. */
export async function updateInsightFields(
  id: string,
  fields: Partial<InsightDraftFields>,
): Promise<Insight | null> {
  const map: Record<keyof InsightDraftFields, string> = {
    title: "title",
    description: "description",
    lede: "lede",
    tldr: "tldr",
    bodyMd: "body_md",
    keyTakeaway: "key_takeaway",
    tags: "tags",
    readingTime: "reading_time",
  };

  const sets: string[] = [];
  const values: unknown[] = [id];
  for (const [key, column] of Object.entries(map) as [
    keyof InsightDraftFields,
    string,
  ][]) {
    const value = fields[key];
    if (value === undefined) continue;
    const json = key === "tldr" || key === "tags";
    values.push(json ? JSON.stringify(value) : value);
    sets.push(`${column} = $${values.length}${json ? "::jsonb" : ""}`);
  }
  if (sets.length === 0) return getInsightById(id);

  const { rows } = await pool.query<DbInsightRow>(
    `UPDATE insight
        SET ${sets.join(", ")}, updated_at = NOW()
      WHERE id = $1 AND status <> 'approved'
      RETURNING ${FULL_COLUMNS}`,
    values,
  );
  return rows[0] ? toInsight(rows[0]) : null;
}

/**
 * Claim the send, publish, and return the row — or return null if someone
 * already claimed it.
 *
 * This is the whole safety property of the approve flow, and the reason it is
 * one statement. `email_sent_at` is set in the same UPDATE that flips the
 * status, so two concurrent approvals, a double-click, or a retried request
 * produce exactly one winner; every other caller gets null and must not send.
 * Claiming BEFORE dispatch is deliberate: a crash mid-send leaves a note that
 * was announced to some people, which is recoverable, rather than one that can
 * be announced again from scratch, which is not.
 */
export async function claimForPublish(id: string): Promise<Insight | null> {
  const { rows } = await pool.query<DbInsightRow>(
    `UPDATE insight
        SET status = 'approved',
            published_at = COALESCE(published_at, NOW()),
            email_sent_at = NOW(),
            updated_at = NOW()
      WHERE id = $1
        AND email_sent_at IS NULL
        AND status = 'draft'
      RETURNING ${FULL_COLUMNS}`,
    [id],
  );
  return rows[0] ? toInsight(rows[0]) : null;
}

/**
 * Drafts whose review window has expired, oldest deadline first.
 *
 * `status = 'draft'` is what excludes a rejected note: rejecting moves the row
 * out of `draft`, so it can never match here no matter what its deadline says.
 *
 * The completeness checks are in the WHERE clause rather than in the caller so
 * a half-written row cannot be selected and then skipped — the auto-publisher
 * has no human reading its output, and a draft missing a body must simply sit
 * there being visibly overdue in the ops queue.
 */
export async function listDraftsDueForPublish(
  limit = 25,
): Promise<InsightMeta[]> {
  const { rows } = await pool.query<DbInsightRow>(
    `SELECT ${META_COLUMNS}
       FROM insight
      WHERE status = 'draft'
        AND email_sent_at IS NULL
        AND auto_publish_at IS NOT NULL
        AND auto_publish_at <= NOW()
        AND post_type = 'pick'
        AND ticker IS NOT NULL
        AND title IS NOT NULL
        AND description IS NOT NULL
        AND body_md IS NOT NULL
      ORDER BY auto_publish_at ASC
      LIMIT $1`,
    [limit],
  );
  return rows.map(toMeta);
}

/**
 * Stop a draft from publishing itself.
 *
 * Clears `auto_publish_at` as well as moving the status: leaving a stale
 * deadline on the row would make the ops queue claim a rejected note is still
 * counting down. Regenerating stamps a fresh one.
 *
 * Returns null when the row is not a draft — most importantly when it is
 * already approved, which is the race this is designed to lose safely. The
 * sweep claims and rejection fails, rather than both appearing to succeed.
 */
export async function rejectInsight(id: string): Promise<Insight | null> {
  const { rows } = await pool.query<DbInsightRow>(
    `UPDATE insight
        SET status = 'rejected',
            auto_publish_at = NULL,
            confirmed_at = NULL,
            updated_at = NOW()
      WHERE id = $1
        AND status = 'draft'
        AND email_sent_at IS NULL
      RETURNING ${FULL_COLUMNS}`,
    [id],
  );
  return rows[0] ? toInsight(rows[0]) : null;
}

/* --------------------------- Weekly reviews ------------------------------- */

/**
 * Placeholder row for this week's Friday review.
 *
 * Slug is the unique key (`weekly-review-2026-w34`). A second Friday 10am
 * firing, or an operator pressing Draft, hits the conflict and returns null
 * so the caller loads the existing row instead of making another.
 */
export async function createPendingWeeklyReview(
  slug: string,
  autoPublishAt: Date,
): Promise<InsightMeta | null> {
  const { rows } = await pool.query<DbInsightRow>(
    `INSERT INTO insight (slug, post_type, status, auto_publish_at)
     VALUES ($1, 'weekly_review', 'pending', $2)
     ON CONFLICT (slug) DO NOTHING
     RETURNING ${META_COLUMNS}`,
    [slug, autoPublishAt],
  );
  return rows[0] ? toMeta(rows[0]) : null;
}

export async function listWeeklyReviews(): Promise<InsightMeta[]> {
  const { rows } = await pool.query<DbInsightRow>(
    `SELECT ${META_COLUMNS}
       FROM insight
      WHERE post_type = 'weekly_review'
      ORDER BY COALESCE(published_at, created_at) DESC`,
  );
  return rows.map(toMeta);
}

/**
 * Arm the Friday send. Does not publish.
 *
 * Completeness is in the WHERE clause so a half-written row cannot be armed
 * and then surprise noon. Returns null when the row is not an unsent draft.
 */
export async function confirmWeeklyReview(id: string): Promise<Insight | null> {
  const { rows } = await pool.query<DbInsightRow>(
    `UPDATE insight
        SET confirmed_at = NOW(),
            updated_at = NOW()
      WHERE id = $1
        AND post_type = 'weekly_review'
        AND status = 'draft'
        AND email_sent_at IS NULL
        AND title IS NOT NULL
        AND description IS NOT NULL
        AND body_md IS NOT NULL
      RETURNING ${FULL_COLUMNS}`,
    [id],
  );
  return rows[0] ? toInsight(rows[0]) : null;
}

/** Disarm before noon. No-op on a row that is already published. */
export async function unconfirmWeeklyReview(
  id: string,
): Promise<Insight | null> {
  const { rows } = await pool.query<DbInsightRow>(
    `UPDATE insight
        SET confirmed_at = NULL,
            updated_at = NOW()
      WHERE id = $1
        AND post_type = 'weekly_review'
        AND status = 'draft'
        AND email_sent_at IS NULL
        AND confirmed_at IS NOT NULL
      RETURNING ${FULL_COLUMNS}`,
    [id],
  );
  return rows[0] ? toInsight(rows[0]) : null;
}

/**
 * The Friday noon claim. Same shape as `claimForPublish`, plus the confirm
 * gate: an unconfirmed draft cannot win this UPDATE no matter what its
 * deadline says.
 */
export async function claimForWeeklyReviewPublish(
  id: string,
): Promise<Insight | null> {
  const { rows } = await pool.query<DbInsightRow>(
    `UPDATE insight
        SET status = 'approved',
            published_at = COALESCE(published_at, NOW()),
            email_sent_at = NOW(),
            updated_at = NOW()
      WHERE id = $1
        AND post_type = 'weekly_review'
        AND status = 'draft'
        AND confirmed_at IS NOT NULL
        AND email_sent_at IS NULL
        AND title IS NOT NULL
        AND description IS NOT NULL
        AND body_md IS NOT NULL
      RETURNING ${FULL_COLUMNS}`,
    [id],
  );
  return rows[0] ? toInsight(rows[0]) : null;
}
