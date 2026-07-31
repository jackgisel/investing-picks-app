import { pool } from "@/lib/db";
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
  post_type: "pick" | "quarterly_review";
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
  created_at: Date;
  updated_at: Date;
}

const META_COLUMNS = `id, slug, ticker, post_type, status, title, description,
  reading_time, tags, author, quarter, published_at, created_at, updated_at`;

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

/** Every note still waiting on a body, oldest first. */
export async function listPendingInsights(): Promise<InsightMeta[]> {
  const { rows } = await pool.query<DbInsightRow>(
    `SELECT ${META_COLUMNS}
       FROM insight
      WHERE status = 'pending'
      ORDER BY created_at ASC`,
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
 */
export async function saveDraft(
  id: string,
  fields: InsightDraftFields,
  sourceFacts: unknown,
  slug?: string,
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
            status = 'draft', generation_error = NULL, updated_at = NOW()
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
    ],
  );
  return rows[0] ? toInsight(rows[0]) : null;
}

/** Record a generation failure so the row never sits wedged in `pending`. */
export async function markGenerationFailed(
  id: string,
  message: string,
): Promise<void> {
  await pool.query(
    `UPDATE insight
        SET status = 'failed', generation_error = $2, updated_at = NOW()
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
