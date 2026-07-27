import { pool } from "@/lib/db";
import type { CommentRow, SubjectType } from "@/lib/comments";

/**
 * Database access for comment threads.
 *
 * Split from `lib/comments.ts` because that module is imported by the thread
 * COMPONENT for its constants and types. Keeping the `pg` import in the same
 * file dragged the driver into the browser bundle, which fails the build on
 * `dns`/`net` — and would otherwise have been fixed by polyfilling rather than
 * by noticing a server module had leaked client-side.
 */

interface DbCommentRow {
  id: string;
  parent_id: string | null;
  body: string;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
  user_id: string;
  display_name: string | null;
}

/**
 * Every comment on a thread, oldest first, including soft-deleted ones.
 *
 * Deleted rows are returned as tombstones rather than dropped because a reply
 * whose parent vanished renders as an orphan with no context. The body is
 * withheld here, in the query layer — a route that forgets to strip it cannot
 * leak removed text.
 */
export async function listComments(
  subjectType: SubjectType,
  subjectSlug: string,
  viewer: { id: string; isAdmin: boolean } | null,
): Promise<CommentRow[]> {
  const { rows } = await pool.query<DbCommentRow>(
    `SELECT c.id, c.parent_id, c.body, c.created_at, c.updated_at, c.deleted_at,
            c.user_id, u.display_name
       FROM post_comment c
       JOIN "user" u ON u.id = c.user_id
      WHERE c.subject_type = $1 AND c.subject_slug = $2
      ORDER BY c.created_at ASC`,
    [subjectType, subjectSlug],
  );

  return rows.map((r) => {
    const deleted = r.deleted_at !== null;
    return {
      id: String(r.id),
      parentId: r.parent_id === null ? null : String(r.parent_id),
      body: deleted ? null : r.body,
      createdAt: r.created_at.toISOString(),
      // Only surfaced when it differs from creation, so an untouched comment
      // is not labelled "edited" by a timestamp that merely defaulted.
      editedAt:
        !deleted && r.updated_at.getTime() !== r.created_at.getTime()
          ? r.updated_at.toISOString()
          : null,
      deleted,
      author: {
        id: r.user_id,
        displayName: deleted ? null : r.display_name,
      },
      canDelete:
        !deleted && viewer !== null && (viewer.isAdmin || viewer.id === r.user_id),
    };
  });
}

/**
 * Insert a comment. `parentId` must already be on the same thread.
 *
 * Replies are flattened to one level: a reply to a reply attaches to the
 * top-level parent. Arbitrary nesting is a rendering and moderation problem
 * out of all proportion to the value on a research post.
 */
export async function createComment(args: {
  subjectType: SubjectType;
  subjectSlug: string;
  userId: string;
  parentId: string | null;
  body: string;
}): Promise<{ id: string } | { error: string }> {
  let parentId: string | null = null;
  if (args.parentId) {
    const { rows } = await pool.query<{ id: string; parent_id: string | null }>(
      `SELECT id, parent_id FROM post_comment
        WHERE id = $1 AND subject_type = $2 AND subject_slug = $3
          AND deleted_at IS NULL`,
      [args.parentId, args.subjectType, args.subjectSlug],
    );
    const parent = rows[0];
    // Checked against the thread, not just by id: without the subject columns
    // in the WHERE clause a caller could graft a reply onto another page's
    // comment and it would render in neither thread correctly.
    if (!parent) return { error: "That comment is no longer available." };
    parentId = String(parent.parent_id ?? parent.id);
  }

  const { rows } = await pool.query<{ id: string }>(
    `INSERT INTO post_comment (subject_type, subject_slug, user_id, parent_id, body)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id`,
    [args.subjectType, args.subjectSlug, args.userId, parentId, args.body],
  );
  return { id: String(rows[0].id) };
}

/**
 * Soft-delete. Returns false when the comment does not exist, is already gone,
 * or the caller does not own it — all three are the same answer to the caller
 * so that probing ids reveals nothing about comments they cannot see.
 */
export async function deleteComment(
  id: string,
  viewer: { id: string; isAdmin: boolean },
): Promise<boolean> {
  const { rowCount } = await pool.query(
    `UPDATE post_comment
        SET deleted_at = NOW()
      WHERE id = $1
        AND deleted_at IS NULL
        AND ($2::boolean OR user_id = $3)`,
    [id, viewer.isAdmin, viewer.id],
  );
  return (rowCount ?? 0) > 0;
}
