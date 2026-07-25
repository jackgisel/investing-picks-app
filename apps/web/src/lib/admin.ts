import crypto from "crypto";
import { NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { ensureMigrations } from "@/lib/auth";
import { getServerUser, type ServerSessionUser } from "@/lib/server-session";

/**
 * Admin access control for the ops surface.
 *
 * Two sources of truth, checked in this order:
 *  1. `ADMIN_EMAILS` — a comma-separated allowlist. This is the bootstrap path
 *     so a fresh deploy has an admin without touching a DB console. A matching
 *     user is promoted (`user.is_admin = true`) on first hit.
 *  2. `user.is_admin` — the column added by runAppMigrations().
 *
 * Route handlers must call `requireAdmin()` themselves. Middleware alone is not
 * enough: it only sees cookies, can't check the DB, and is easy to bypass by
 * adding a route the matcher doesn't cover.
 */

export function adminEmails(): string[] {
  return (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

/** 404 rather than 401/403 — non-admins shouldn't learn the surface exists. */
export function notFoundResponse(): NextResponse {
  return NextResponse.json({ error: "Not found" }, { status: 404 });
}

/** Persist the admin flag so the allowlist/token can be removed later. */
async function promote(userId: string): Promise<void> {
  try {
    await pool.query(`UPDATE "user" SET is_admin = TRUE WHERE id = $1`, [
      userId,
    ]);
  } catch (e) {
    console.error("Failed to persist admin flag:", e);
  }
}

/**
 * Claim admin with the one-time bootstrap token.
 *
 * The ADMIN_EMAILS allowlist matches on an email STRING, so on a fresh
 * database the admin address is an unclaimed username — whoever registers it
 * first would otherwise take the ops surface. Proving control of the address
 * closes that, but email is not always available (no provider configured yet),
 * so ADMIN_BOOTSTRAP_TOKEN is the alternative proof: it is known only to
 * whoever can read the deployment's environment.
 *
 * Requires BOTH the token and an allowlisted email, so a leaked token alone
 * grants nothing.
 */
export async function claimAdminWithToken(
  user: ServerSessionUser,
  suppliedToken: string
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const expected = process.env.ADMIN_BOOTSTRAP_TOKEN;
  if (!expected || !expected.trim()) {
    return { ok: false, reason: "Bootstrap token is not configured" };
  }
  if (!adminEmails().includes(user.email.toLowerCase())) {
    return { ok: false, reason: "This account is not on the admin allowlist" };
  }

  const a = Buffer.from(suppliedToken);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return { ok: false, reason: "Invalid token" };
  }

  await promote(user.id);
  return { ok: true };
}

async function isAdminUser(user: ServerSessionUser): Promise<boolean> {
  const email = user.email.toLowerCase();

  // Auto-promote on an allowlisted AND verified address. Verification is the
  // proof of control; without it, see claimAdminWithToken above.
  if (adminEmails().includes(email) && user.emailVerified) {
    await promote(user.id);
    return true;
  }

  try {
    const { rows } = await pool.query<{ is_admin: boolean | null }>(
      `SELECT is_admin FROM "user" WHERE id = $1`,
      [user.id]
    );
    return rows[0]?.is_admin === true;
  } catch (e) {
    // Fail closed — a broken query must never grant access.
    console.error("Admin lookup failed:", e);
    return false;
  }
}

/** Resolves the signed-in admin, or null if not signed in / not an admin. */
export async function getAdminUser(): Promise<ServerSessionUser | null> {
  await ensureMigrations();
  const user = await getServerUser();
  if (!user) return null;
  return (await isAdminUser(user)) ? user : null;
}

/**
 * Guard for ops route handlers.
 *
 *   const guard = await requireAdmin();
 *   if (!guard.ok) return guard.response;
 */
export async function requireAdmin(): Promise<
  { ok: true; user: ServerSessionUser } | { ok: false; response: NextResponse }
> {
  const user = await getAdminUser();
  if (!user) return { ok: false, response: notFoundResponse() };
  return { ok: true, user };
}

/**
 * Headers for the upstream FastAPI ops API.
 *
 * Throws when OPS_API_KEY is missing — no `dev-ops-key` fallback. A silent
 * fallback meant an unset key in production still produced a valid request
 * against an API that also defaulted to the same literal.
 */
export function opsHeaders(extra?: Record<string, string>): Record<string, string> {
  const key = process.env.OPS_API_KEY;
  if (!key || !key.trim()) {
    throw new Error(
      "OPS_API_KEY is not set. The ops API cannot be reached without it."
    );
  }
  return { "X-Ops-Key": key, ...(extra || {}) };
}

/** Uniform 503 when OPS_API_KEY is missing, so admins see a real error. */
export function opsMisconfiguredResponse(e: unknown): NextResponse {
  console.error("Ops proxy misconfigured:", e);
  return NextResponse.json(
    { error: "Ops API is not configured (OPS_API_KEY missing)." },
    { status: 503 }
  );
}
