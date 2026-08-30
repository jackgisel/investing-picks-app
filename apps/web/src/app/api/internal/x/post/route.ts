import { NextResponse } from "next/server";
import { ensureMigrations } from "@/lib/auth";
import { requireInternalSecret } from "@/lib/internal-auth";
import { postConfirmedThreads } from "@/lib/x-thread-sync";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * The worker's posting tick. Posts only threads an admin confirmed.
 *
 * An empty queue and an unconfigured account are both 200s — they are the
 * normal state of this endpoint most of the time, and returning an error for
 * them would page someone every tick.
 */
export async function POST(req: Request) {
  const guard = requireInternalSecret(req);
  if (!guard.ok) return guard.response;

  await ensureMigrations();
  try {
    return NextResponse.json(await postConfirmedThreads());
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Posting threads failed" },
      { status: 502 },
    );
  }
}
