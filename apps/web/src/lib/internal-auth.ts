import { NextResponse } from "next/server";

/**
 * Shared-secret guard for `/api/internal/*` — the worker's entry points.
 *
 * One credential for all of them, deliberately: the caller is a single process
 * and a second secret would be a second thing to rotate. These routes are not
 * session-authenticated because the worker has no session; they are reachable
 * only by something holding `INTERNAL_API_SECRET`.
 *
 * Extracted once the third route needed it. The comparison is constant-time,
 * and a copy of that in five files is five chances for one to be written with
 * `===` and leak the secret a character at a time.
 */

export type InternalGuard =
  | { ok: true }
  | { ok: false; response: NextResponse };

export function requireInternalSecret(req: Request): InternalGuard {
  const secret = process.env.INTERNAL_API_SECRET;
  if (!secret) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "INTERNAL_API_SECRET is not configured on the server" },
        { status: 500 },
      ),
    };
  }

  const authHeader = req.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  if (
    authHeader.length !== expected.length ||
    !timingSafeEqual(authHeader, expected)
  ) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  return { ok: true };
}

/**
 * Constant-time compare so the header check leaks no timing.
 *
 * The length check above is what makes this safe to call on unequal strings —
 * this loop assumes they match and would read past the end otherwise.
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}
