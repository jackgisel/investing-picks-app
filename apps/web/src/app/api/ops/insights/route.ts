import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { ensureMigrations } from "@/lib/auth";
import { syncAddDrafts, syncExitDrafts, syncPickDrafts } from "@/lib/insight-sync";
import { cyclePicks } from "@/lib/insights";
import { listInsights } from "@/lib/insights-db";
import { fetchRecentTrades } from "@/lib/pick-cycle";

export const dynamic = "force-dynamic";

/** Every note, any status — the review queue. */
export async function GET() {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  await ensureMigrations();
  const insights = (await listInsights({ includeUnpublished: true })).filter(
    (i) => i.postType !== "weekly_review",
  );

  // Unsent pick notes that will go out in one mail with each other, keyed by
  // note id. Mirrors what `lib/pick-cycle.ts` does at send time so the queue
  // can say "sends with MU" before anyone approves.
  const unsent = insights.filter(
    (i) => i.postType === "pick" && i.ticker && i.status !== "approved" && i.status !== "rejected",
  );
  const cycleWith: Record<string, string[]> = {};
  if (unsent.length > 1) {
    const trades = await fetchRecentTrades();
    const open = new Set(unsent.map((i) => i.ticker!.toUpperCase()));
    for (const i of unsent) {
      const others = cyclePicks(trades, i.ticker!).filter((t) => open.has(t));
      if (others.length) cycleWith[i.id] = others;
    }
  }

  return NextResponse.json({ insights, cycleWith });
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
    const adds = await syncAddDrafts({ generate: true });
    const exits = await syncExitDrafts({ generate: true });
    return NextResponse.json({ ...picks, picks, exits, adds });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Sync failed" },
      { status: 502 },
    );
  }
}
