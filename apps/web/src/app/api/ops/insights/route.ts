import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { ensureMigrations } from "@/lib/auth";
import { syncExitDrafts, syncPickDrafts } from "@/lib/insight-sync";
import { listInsights } from "@/lib/insights-db";

export const dynamic = "force-dynamic";

/** Every note, any status — the review queue. */
export async function GET() {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  await ensureMigrations();
  return NextResponse.json({
    insights: (await listInsights({ includeUnpublished: true })).filter(
      (i) => i.postType !== "weekly_review",
    ),
  });
}

/**
 * Run the reconciliation sweep by hand.
 *
 * The same thing the worker calls on a schedule. Exposed to the ops page so an
 * admin who has just added a position does not have to wait for the next
 * scheduled run to see a draft appear.
 */
export async function POST() {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  await ensureMigrations();
  try {
    const picks = await syncPickDrafts({ generate: true });
    const exits = await syncExitDrafts({ generate: true });
    return NextResponse.json({ ...picks, picks, exits });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Sync failed" },
      { status: 502 },
    );
  }
}
