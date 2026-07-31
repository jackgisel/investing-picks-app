import crypto from "crypto";
import { pool } from "@/lib/db";

/**
 * One-click unsubscribe for member pick alerts.
 *
 * Pick alerts are the only true bulk send to accounts: /api/internal/notify-pick
 * fans one message out to every opted-in user. Since 2024 Gmail and Yahoo
 * throttle or spam-folder bulk senders that ship no List-Unsubscribe, and RFC
 * 8058 one-click requires an unauthenticated POST target — which the settings
 * page cannot be, because it is behind a login.
 *
 * The token is an HMAC of the user id rather than a stored column, so there is
 * no migration and nothing to keep in sync with the user row. Rotating
 * BETTER_AUTH_SECRET invalidates every outstanding link at once, which is the
 * behaviour you want from a mail token anyway.
 */

function secret(): string {
  const s = process.env.BETTER_AUTH_SECRET;
  if (!s || !s.trim()) {
    throw new Error(
      "BETTER_AUTH_SECRET is not set; pick-alert unsubscribe tokens cannot be signed"
    );
  }
  return s;
}

function sign(userId: string): string {
  return crypto
    .createHmac("sha256", secret())
    .update(`pick-alerts:${userId}`)
    .digest("base64url");
}

export function pickAlertToken(userId: string): string {
  return `${Buffer.from(userId).toString("base64url")}.${sign(userId)}`;
}

/** The user id carried by a token, or null if it is malformed or not ours. */
export function verifyPickAlertToken(token: string): string | null {
  const dot = token.indexOf(".");
  if (dot <= 0) return null;

  let userId: string;
  try {
    userId = Buffer.from(token.slice(0, dot), "base64url").toString("utf8");
  } catch {
    return null;
  }
  if (!userId) return null;

  const supplied = Buffer.from(token.slice(dot + 1));
  const expected = Buffer.from(sign(userId));
  // Length check first: timingSafeEqual throws on a mismatch rather than
  // returning false, and a forged token is exactly where that would happen.
  if (supplied.length !== expected.length) return null;
  return crypto.timingSafeEqual(supplied, expected) ? userId : null;
}

/**
 * Turn off pick alerts for the holder of `token`.
 *
 * Only `new_picks` is touched — an unsubscribe from one list must not silently
 * clear the others. The INSERT branch writes DEFAULT_PREFS for the rest, which
 * is what a user with no row was already receiving.
 */
export async function unsubscribeFromPickAlerts(
  token: string
): Promise<{ ok: boolean }> {
  const userId = verifyPickAlertToken(token);
  if (!userId) return { ok: false };

  try {
    await pool.query(
      `INSERT INTO user_preferences
          (user_id, new_picks, weekly_summary, performance_alerts, product_updates, updated_at)
        VALUES ($1, FALSE, TRUE, TRUE, FALSE, NOW())
        ON CONFLICT (user_id) DO UPDATE SET
          new_picks = FALSE,
          updated_at = NOW()`,
      [userId]
    );
    return { ok: true };
  } catch (e) {
    console.error("Pick-alert unsubscribe failed:", e);
    return { ok: false };
  }
}
