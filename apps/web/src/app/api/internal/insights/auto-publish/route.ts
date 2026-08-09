import { NextResponse } from "next/server";
import { ensureMigrations } from "@/lib/auth";
import { requireInternalSecret } from "@/lib/internal-auth";
import { autoPublishDueDrafts } from "@/lib/insight-auto-publish";

export const dynamic = "force-dynamic";

/**
 * The worker's tick for the auto-publisher.
 *
 * Idempotent and safe to call as often as you like: the sweep only acts on
 * drafts past their deadline, and `claimForPublish` means a duplicate call
 * racing the first one publishes nothing twice.
 *
 * Unlike `sync`, this route sends email to the whole list. It is a POST with a
 * shared secret for that reason and must never be reachable from a GET.
 */
export async function POST(req: Request) {
  const guard = requireInternalSecret(req);
  if (!guard.ok) return guard.response;

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
