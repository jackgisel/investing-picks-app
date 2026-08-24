import { pool } from "@/lib/db";

/**
 * "Has this exact message already gone out?" — one answer, shared by every
 * recurring send.
 *
 * The pick announcement gets this guarantee from `insight.email_sent_at`: the
 * row is claimed in the same statement that publishes, so a double-click or two
 * overlapping jobs still produce one email. Every other recurring send needs
 * the identical property, and giving each its own column is how one of them
 * ends up shipped without it.
 *
 * Claim BEFORE sending, never after. A crash mid-send leaves a message that
 * went to some of the list — recoverable, and visible. Claiming afterwards
 * would leave one that looks unsent and can be sent again from scratch, which
 * is not recoverable, because there is no un-send.
 */

/** Feature namespaces. Adding one here is cheaper than a new table. */
export type DispatchKind =
  | "weekly_summary"
  | "performance_alert"
  | "job_failure"
  /** The free weekly Market Note. Keyed by ISO week. */
  | "market_note";

/**
 * Claim the right to send `kind`/`key`. True exactly once.
 *
 * Errors deliberately return FALSE rather than throwing. Every caller is a
 * scheduled sweep, and "the ledger is unreachable" must read as "do not send" —
 * treating a failed claim as permission is how an outage becomes a duplicate
 * mailing to the whole list.
 */
export async function claimDispatch(
  kind: DispatchKind,
  key: string,
  recipients = 0,
): Promise<boolean> {
  try {
    const { rowCount } = await pool.query(
      `INSERT INTO email_dispatch (kind, dedupe_key, recipients)
         VALUES ($1, $2, $3)
         ON CONFLICT (kind, dedupe_key) DO NOTHING`,
      [kind, key, recipients],
    );
    return rowCount === 1;
  } catch (e) {
    console.error(`Dispatch claim failed for ${kind}/${key}:`, e);
    return false;
  }
}

/**
 * Release a claim so the next sweep may retry.
 *
 * Only for the case where the claim succeeded and then NOTHING was sent — the
 * mailer threw before the first message left. Calling this after a partial send
 * re-sends to everyone who already received it.
 */
export async function releaseDispatch(
  kind: DispatchKind,
  key: string,
): Promise<void> {
  try {
    await pool.query(
      `DELETE FROM email_dispatch WHERE kind = $1 AND dedupe_key = $2`,
      [kind, key],
    );
  } catch (e) {
    console.error(`Dispatch release failed for ${kind}/${key}:`, e);
  }
}

/** Whether this message has already gone out. Read-only; does not claim. */
export async function wasDispatched(
  kind: DispatchKind,
  key: string,
): Promise<boolean> {
  const { rowCount } = await pool.query(
    `SELECT 1 FROM email_dispatch WHERE kind = $1 AND dedupe_key = $2`,
    [kind, key],
  );
  return (rowCount ?? 0) > 0;
}

/** ISO week key (`2026-W32`) — the dedupe key for the weekly digest. */
export function isoWeekKey(d: Date = new Date()): string {
  // Copy to UTC midnight so a server in any timezone derives the same week.
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  // ISO weeks run Monday–Sunday and belong to the year containing their
  // Thursday. Shifting to that Thursday first is what makes the turn of the
  // year come out right instead of producing a week 53 that should be week 1.
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}
