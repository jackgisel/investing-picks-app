import { pool } from "@/lib/db";

/**
 * Persistence for X threads.
 *
 * The claim discipline here is the one `email-dispatch.ts` argues for, and for
 * the same reason: there is no un-post. `claimThreadForPosting` sets
 * `posted_at` in the SAME statement that checks the confirm gate, so two
 * overlapping worker ticks cannot both win, and a crash mid-thread leaves a
 * partially posted thread that is visible rather than one that looks unposted
 * and will be posted again from the top.
 */

export type XThreadKind = "pick" | "weekly_review" | "market" | "spotlight";
export type XThreadStatus = "draft" | "posted" | "failed" | "rejected";

export type XThread = {
  id: string;
  kind: XThreadKind;
  dedupeKey: string;
  posts: string[];
  facts: Record<string, unknown>;
  status: XThreadStatus;
  confirmedAt: Date | null;
  postedAt: Date | null;
  postedIds: string[];
  failedAtIndex: number | null;
  error: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type DbRow = {
  id: string;
  kind: XThreadKind;
  dedupe_key: string;
  posts: unknown;
  facts: unknown;
  status: XThreadStatus;
  confirmed_at: Date | null;
  posted_at: Date | null;
  posted_ids: unknown;
  failed_at_index: number | null;
  error: string | null;
  created_at: Date;
  updated_at: Date;
};

const COLUMNS = `id, kind, dedupe_key, posts, facts, status, confirmed_at,
                 posted_at, posted_ids, failed_at_index, error,
                 created_at, updated_at`;

function toThread(row: DbRow): XThread {
  return {
    id: String(row.id),
    kind: row.kind,
    dedupeKey: row.dedupe_key,
    posts: Array.isArray(row.posts) ? (row.posts as string[]) : [],
    facts: (row.facts as Record<string, unknown>) ?? {},
    status: row.status,
    confirmedAt: row.confirmed_at,
    postedAt: row.posted_at,
    postedIds: Array.isArray(row.posted_ids) ? (row.posted_ids as string[]) : [],
    failedAtIndex: row.failed_at_index,
    error: row.error,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Insert a draft, or return the existing row for this key untouched.
 *
 * `DO NOTHING` rather than an upsert: re-running the Friday draft job must not
 * overwrite a thread an admin has already edited by hand. The operator's
 * "redraft" button deletes the row first, which is an explicit act.
 */
export async function createThreadDraft(args: {
  kind: XThreadKind;
  dedupeKey: string;
  posts: string[];
  facts: Record<string, unknown>;
}): Promise<{ thread: XThread; created: boolean }> {
  const { rows } = await pool.query<DbRow>(
    `INSERT INTO x_thread (kind, dedupe_key, posts, facts)
       VALUES ($1, $2, $3::jsonb, $4::jsonb)
       ON CONFLICT (kind, dedupe_key) DO NOTHING
       RETURNING ${COLUMNS}`,
    [
      args.kind,
      args.dedupeKey,
      JSON.stringify(args.posts),
      JSON.stringify(args.facts),
    ],
  );
  if (rows[0]) return { thread: toThread(rows[0]), created: true };

  const existing = await getThreadByKey(args.kind, args.dedupeKey);
  if (!existing) {
    throw new Error(
      `x_thread ${args.kind}/${args.dedupeKey} neither inserted nor found`,
    );
  }
  return { thread: existing, created: false };
}

export async function getThreadByKey(
  kind: XThreadKind,
  dedupeKey: string,
): Promise<XThread | null> {
  const { rows } = await pool.query<DbRow>(
    `SELECT ${COLUMNS} FROM x_thread WHERE kind = $1 AND dedupe_key = $2`,
    [kind, dedupeKey],
  );
  return rows[0] ? toThread(rows[0]) : null;
}

export async function getThreadById(id: string): Promise<XThread | null> {
  const { rows } = await pool.query<DbRow>(
    `SELECT ${COLUMNS} FROM x_thread WHERE id = $1`,
    [id],
  );
  return rows[0] ? toThread(rows[0]) : null;
}

export async function listThreads(limit = 50): Promise<XThread[]> {
  const { rows } = await pool.query<DbRow>(
    `SELECT ${COLUMNS} FROM x_thread ORDER BY created_at DESC LIMIT $1`,
    [limit],
  );
  return rows.map(toThread);
}

/** Edit the post bodies. Only while it is still an unposted draft. */
export async function updateThreadPosts(
  id: string,
  posts: string[],
): Promise<XThread | null> {
  const { rows } = await pool.query<DbRow>(
    `UPDATE x_thread
        SET posts = $2::jsonb, updated_at = NOW()
      WHERE id = $1 AND status = 'draft' AND posted_at IS NULL
      RETURNING ${COLUMNS}`,
    [id, JSON.stringify(posts)],
  );
  return rows[0] ? toThread(rows[0]) : null;
}

/**
 * Arm a thread for posting.
 *
 * Requires at least one post: confirming an empty draft would otherwise let
 * the publish job "succeed" having said nothing.
 */
export async function confirmThread(id: string): Promise<XThread | null> {
  const { rows } = await pool.query<DbRow>(
    `UPDATE x_thread
        SET confirmed_at = NOW(), updated_at = NOW()
      WHERE id = $1
        AND status = 'draft'
        AND posted_at IS NULL
        AND jsonb_array_length(posts) > 0
      RETURNING ${COLUMNS}`,
    [id],
  );
  return rows[0] ? toThread(rows[0]) : null;
}

/** Disarm before the job runs. No-op once posting has been claimed. */
export async function unconfirmThread(id: string): Promise<XThread | null> {
  const { rows } = await pool.query<DbRow>(
    `UPDATE x_thread
        SET confirmed_at = NULL, updated_at = NOW()
      WHERE id = $1 AND status = 'draft' AND posted_at IS NULL
      RETURNING ${COLUMNS}`,
    [id],
  );
  return rows[0] ? toThread(rows[0]) : null;
}

export async function rejectThread(id: string): Promise<XThread | null> {
  const { rows } = await pool.query<DbRow>(
    `UPDATE x_thread
        SET status = 'rejected', confirmed_at = NULL, updated_at = NOW()
      WHERE id = $1 AND status = 'draft' AND posted_at IS NULL
      RETURNING ${COLUMNS}`,
    [id],
  );
  return rows[0] ? toThread(rows[0]) : null;
}

/**
 * Win the exclusive right to post this thread. True for exactly one caller.
 *
 * Claims BEFORE anything is posted. The confirm gate is part of the same
 * UPDATE rather than a prior SELECT, so an unconfirmed draft cannot slip
 * through between the check and the claim.
 */
export async function claimThreadForPosting(
  id: string,
): Promise<XThread | null> {
  const { rows } = await pool.query<DbRow>(
    `UPDATE x_thread
        SET posted_at = NOW(), updated_at = NOW()
      WHERE id = $1
        AND status = 'draft'
        AND confirmed_at IS NOT NULL
        AND posted_at IS NULL
        AND jsonb_array_length(posts) > 0
      RETURNING ${COLUMNS}`,
    [id],
  );
  return rows[0] ? toThread(rows[0]) : null;
}

/**
 * Record the outcome of a claimed post.
 *
 * A partial thread is `failed` WITH its posted ids, never rolled back to
 * draft. Those posts are public; making the row look unposted would invite a
 * second run that duplicates them.
 */
export async function recordThreadResult(
  id: string,
  result: {
    postedIds: string[];
    failedAtIndex: number | null;
    error: string | null;
  },
): Promise<XThread | null> {
  const { rows } = await pool.query<DbRow>(
    `UPDATE x_thread
        SET status = $2,
            posted_ids = $3::jsonb,
            failed_at_index = $4,
            error = $5,
            updated_at = NOW()
      WHERE id = $1
      RETURNING ${COLUMNS}`,
    [
      id,
      result.error === null ? "posted" : "failed",
      JSON.stringify(result.postedIds),
      result.failedAtIndex,
      result.error,
    ],
  );
  return rows[0] ? toThread(rows[0]) : null;
}

/**
 * Release a claim that posted NOTHING, so a later run may retry.
 *
 * Only safe when `posted` is empty — a pre-flight validation failure, or the
 * very first request throwing. Calling this after a partial thread would
 * re-post the part that already landed.
 */
export async function releaseThreadClaim(id: string): Promise<void> {
  await pool.query(
    `UPDATE x_thread
        SET posted_at = NULL, updated_at = NOW()
      WHERE id = $1 AND jsonb_array_length(posted_ids) = 0`,
    [id],
  );
}

/** Confirmed drafts waiting for the next posting tick. */
export async function listThreadsReadyToPost(limit = 5): Promise<XThread[]> {
  const { rows } = await pool.query<DbRow>(
    `SELECT ${COLUMNS} FROM x_thread
       WHERE status = 'draft' AND confirmed_at IS NOT NULL AND posted_at IS NULL
       ORDER BY confirmed_at ASC
       LIMIT $1`,
    [limit],
  );
  return rows.map(toThread);
}
