import { NextResponse } from "next/server";
import { ensureMigrations } from "@/lib/auth";
import { requireInternalSecret } from "@/lib/internal-auth";
import { syncPickDrafts } from "@/lib/insight-sync";

export const dynamic = "force-dynamic";

/**
 * The worker's entry point into the drafting pipeline.
 *
 * This can run for minutes: it drafts every pending note sequentially, and
 * each is a model call. The worker's timeout has to allow for that. Long work
 * belongs here rather than on the ops page precisely so nobody sits watching a
 * spinner while Claude writes.
 *
 * Creates and drafts only. Nothing it does mails anyone — publication is the
 * auto-publisher's job, one review window later.
 */
export async function POST(req: Request) {
  const guard = requireInternalSecret(req);
  if (!guard.ok) return guard.response;

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
