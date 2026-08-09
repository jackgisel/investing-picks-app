import { NextResponse } from "next/server";
import { ensureMigrations } from "@/lib/auth";
import { autoPublishDueDrafts } from "@/lib/insight-auto-publish";

export const dynamic = "force-dynamic";

/**
 * The worker's tick for the auto-publisher.
 *
 * Auth: the same `INTERNAL_API_SECRET` bearer as the sibling `sync` route —
 * same caller, same process, and a second secret would be a second thing to
 * rotate.
 *
 * Idempotent and safe to call as often as you like: the sweep only acts on
 * drafts past their deadline, and `claimForPublish` means a duplicate call
 * racing the first one publishes nothing twice.
 *
 * Unlike `sync`, this route sends email to the whole list. It is a POST with a
 * shared secret for that reason and must never be reachable from a GET.
 */
export async function POST(req: Request) {
  const secret = process.env.INTERNAL_API_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "INTERNAL_API_SECRET is not configured on the server" },
      { status: 500 },
    );
  }

  const authHeader = req.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  if (
    authHeader.length !== expected.length ||
    !timingSafeEqual(authHeader, expected)
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await ensureMigrations();
  try {
    const result = await autoPublishDueDrafts();
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Auto-publish failed" },
      { status: 502 },
    );
  }
}

/** Constant-time compare so the header check leaks no timing. */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}
