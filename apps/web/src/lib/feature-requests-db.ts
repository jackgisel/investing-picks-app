import { pool } from "@/lib/db";
import type {
  FeatureRequest,
  FeatureRequestStatus,
  FeatureRequestWithAuthor,
} from "@/lib/feature-requests";

/**
 * Database access for feature requests.
 *
 * Split from `lib/feature-requests.ts` because that module is imported by the
 * form COMPONENT for its limits and status labels. See the note at the top of
 * `comments-db.ts` for what happens when the `pg` import leaks client-side.
 */

type Row = {
  id: string;
  title: string;
  body: string;
  status: FeatureRequestStatus;
  admin_note: string | null;
  created_at: Date;
  updated_at: Date;
};

type RowWithAuthor = Row & {
  user_id: string;
  display_name: string | null;
  email: string;
};

const COLUMNS = `id, title, body, status, admin_note, created_at, updated_at`;

function toRequest(r: Row): FeatureRequest {
  return {
    id: String(r.id),
    title: r.title,
    body: r.body,
    status: r.status,
    adminNote: r.admin_note,
    createdAt: r.created_at.toISOString(),
    updatedAt: r.updated_at.toISOString(),
  };
}

export async function createFeatureRequest(args: {
  userId: string;
  title: string;
  body: string;
}): Promise<FeatureRequest> {
  const { rows } = await pool.query<Row>(
    `INSERT INTO feature_request (user_id, title, body)
     VALUES ($1, $2, $3)
     RETURNING ${COLUMNS}`,
    [args.userId, args.title, args.body],
  );
  return toRequest(rows[0]);
}

/**
 * How many this user has submitted in the last rolling 24 hours.
 *
 * Rolling rather than calendar-day: a day boundary lets someone send the cap
 * twice in a couple of minutes either side of midnight.
 */
export async function countRecentByUser(userId: string): Promise<number> {
  const { rows } = await pool.query<{ count: string }>(
    `SELECT COUNT(*)::text AS count
       FROM feature_request
      WHERE user_id = $1 AND created_at > NOW() - INTERVAL '24 hours'`,
    [userId],
  );
  return Number(rows[0]?.count ?? 0);
}

/** A member's own requests, newest first. They never see anyone else's. */
export async function listOwnFeatureRequests(
  userId: string,
): Promise<FeatureRequest[]> {
  const { rows } = await pool.query<Row>(
    `SELECT ${COLUMNS} FROM feature_request
      WHERE user_id = $1
      ORDER BY created_at DESC
      LIMIT 100`,
    [userId],
  );
  return rows.map(toRequest);
}

/**
 * Every request, for the ops triage list.
 *
 * The join carries the email as well as the display name: triage often means
 * replying to the person, and most members never set a display name.
 */
export async function listAllFeatureRequests(): Promise<
  FeatureRequestWithAuthor[]
> {
  const { rows } = await pool.query<RowWithAuthor>(
    `SELECT f.id, f.title, f.body, f.status, f.admin_note,
            f.created_at, f.updated_at,
            f.user_id, u.display_name, u.email
       FROM feature_request f
       JOIN "user" u ON u.id = f.user_id
      ORDER BY f.created_at DESC
      LIMIT 500`,
  );
  return rows.map((r) => ({
    ...toRequest(r),
    author: {
      id: r.user_id,
      displayName: r.display_name,
      email: r.email,
    },
  }));
}

/**
 * Apply a triage decision. Returns null when the id does not exist.
 *
 * Both fields are optional and only the supplied ones are written — COALESCE
 * on the parameter, so passing just a status leaves an existing note alone
 * rather than blanking it. Clearing a note is an explicit empty string, which
 * is stored as NULL so the member page has one "no note" case to render.
 */
export async function updateFeatureRequest(
  id: string,
  patch: { status?: FeatureRequestStatus; adminNote?: string },
): Promise<FeatureRequest | null> {
  const { rows } = await pool.query<Row>(
    `UPDATE feature_request
        SET status = COALESCE($2, status),
            admin_note = CASE
              WHEN $3::text IS NULL THEN admin_note
              WHEN $3 = '' THEN NULL
              ELSE $3
            END,
            updated_at = NOW()
      WHERE id = $1
      RETURNING ${COLUMNS}`,
    [id, patch.status ?? null, patch.adminNote ?? null],
  );
  return rows[0] ? toRequest(rows[0]) : null;
}
