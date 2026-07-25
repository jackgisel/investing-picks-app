import { randomBytes } from "crypto";
import { pool } from "@/lib/db";

/**
 * The weekly market note list.
 *
 * This is the only free thing Outpick offers: no delayed picks, no trial. An
 * address here is a lead, not an account — see `market_note_subscriber` in
 * lib/app-migrations.ts for why it is not keyed to "user".
 */

export type SubscribeResult =
  | { ok: true; status: "subscribed" | "resubscribed" | "already" }
  | { ok: false; reason: "invalid_email" | "error" };

/**
 * Deliberately permissive. Strict RFC 5322 validation rejects real addresses,
 * and the send itself is the real validator — a bad address just bounces. This
 * only needs to catch typos and obvious junk before they reach the table.
 */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function normaliseEmail(raw: string): string | null {
  const email = raw.trim().toLowerCase();
  if (email.length === 0 || email.length > 254) return null;
  if (!EMAIL_RE.test(email)) return null;
  return email;
}

function newToken(): string {
  return randomBytes(24).toString("base64url");
}

/**
 * Idempotent subscribe.
 *
 * Returns which of the three things happened so the caller can decide whether
 * to send a welcome email — resubscribing after an opt-out should feel like a
 * fresh start, but a duplicate submit from someone already on the list must not
 * mail them again.
 */
export async function subscribe(
  rawEmail: string,
  source: string | null
): Promise<SubscribeResult & { token?: string }> {
  const email = normaliseEmail(rawEmail);
  if (!email) return { ok: false, reason: "invalid_email" };

  try {
    const existing = await pool.query<{ token: string; unsubscribed_at: Date | null }>(
      `SELECT token, unsubscribed_at FROM market_note_subscriber WHERE email = $1`,
      [email]
    );

    if (existing.rows[0]) {
      const row = existing.rows[0];
      if (row.unsubscribed_at === null) {
        return { ok: true, status: "already", token: row.token };
      }
      // Clear the opt-out and re-issue the token, so a link from a previous
      // subscription period cannot unsubscribe the new one.
      const token = newToken();
      await pool.query(
        `UPDATE market_note_subscriber
            SET unsubscribed_at = NULL, token = $2, source = $3, created_at = NOW()
          WHERE email = $1`,
        [email, token, source]
      );
      return { ok: true, status: "resubscribed", token };
    }

    const token = newToken();
    await pool.query(
      `INSERT INTO market_note_subscriber (email, token, source)
       VALUES ($1, $2, $3)
       ON CONFLICT (email) DO NOTHING`,
      [email, token, source]
    );
    return { ok: true, status: "subscribed", token };
  } catch (e) {
    console.error("[market-note] subscribe failed:", e);
    return { ok: false, reason: "error" };
  }
}

/** One-click unsubscribe. Returns the address so the page can confirm it. */
export async function unsubscribeByToken(
  token: string
): Promise<{ ok: true; email: string } | { ok: false }> {
  if (!token) return { ok: false };
  try {
    const result = await pool.query<{ email: string }>(
      `UPDATE market_note_subscriber
          SET unsubscribed_at = COALESCE(unsubscribed_at, NOW())
        WHERE token = $1
        RETURNING email`,
      [token]
    );
    const row = result.rows[0];
    return row ? { ok: true, email: row.email } : { ok: false };
  } catch (e) {
    console.error("[market-note] unsubscribe failed:", e);
    return { ok: false };
  }
}

/** Active list, for the weekly send. */
export async function listActiveSubscribers(): Promise<
  { email: string; token: string }[]
> {
  const result = await pool.query<{ email: string; token: string }>(
    `SELECT email, token FROM market_note_subscriber
      WHERE unsubscribed_at IS NULL
      ORDER BY created_at`
  );
  return result.rows;
}

export async function countActiveSubscribers(): Promise<number> {
  const result = await pool.query<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM market_note_subscriber
      WHERE unsubscribed_at IS NULL`
  );
  return Number(result.rows[0]?.count ?? 0);
}
