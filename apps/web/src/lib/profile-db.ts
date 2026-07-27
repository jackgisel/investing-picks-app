import { pool } from "@/lib/db";

/**
 * Database access for the public profile.
 *
 * Split from `lib/profile.ts` for the same reason as `comments-db.ts`: the
 * avatar component imports the pure helpers, and a `pg` import in that path
 * ends up in the browser bundle.
 */

export async function getDisplayName(userId: string): Promise<string | null> {
  const { rows } = await pool.query<{ display_name: string | null }>(
    `SELECT display_name FROM "user" WHERE id = $1`,
    [userId],
  );
  return rows[0]?.display_name ?? null;
}

export async function setDisplayName(
  userId: string,
  displayName: string,
): Promise<void> {
  await pool.query(`UPDATE "user" SET display_name = $1 WHERE id = $2`, [
    displayName,
    userId,
  ]);
}
