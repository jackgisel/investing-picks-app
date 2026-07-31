import { NextResponse } from "next/server";
import { ensureMigrations } from "@/lib/auth";
import { syncPickDrafts } from "@/lib/insight-sync";

export const dynamic = "force-dynamic";

/**
 * The worker's entry point into the drafting pipeline.
 *
 * Auth: shared secret in `Authorization: Bearer <INTERNAL_API_SECRET>` — the
 * same credential `notify-pick` uses, rather than a second one, because the
 * caller is the same process and a second secret is a second thing to rotate.
 *
 * This can run for minutes: it drafts every pending note sequentially, and
 * each is a model call. The worker's timeout has to allow for that. Long work
 * belongs here rather than on the ops page precisely so nobody sits watching a
 * spinner while Claude writes.
 *
 * Creates and drafts only. Nothing it does is visible to a subscriber until an
 * admin approves.
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
    const result = await syncPickDrafts({ generate: true });
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Sync failed" },
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
