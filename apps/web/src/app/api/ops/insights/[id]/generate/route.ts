import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { ensureMigrations } from "@/lib/auth";
import { regenerateExitInsight, regenerateInsight } from "@/lib/insight-sync";
import { getInsightById } from "@/lib/insights-db";

export const dynamic = "force-dynamic";

/**
 * Draft, or re-draft, one note.
 *
 * Discards whatever body the row currently holds, including admin edits — the
 * UI confirms before calling this. Approved notes are refused outright: the
 * text is what subscribers were mailed a link to, and rewriting it after the
 * fact makes the announcement and the page disagree.
 */
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  await ensureMigrations();
  const { id } = await params;
  const insight = await getInsightById(id);
  if (!insight) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (insight.status === "approved") {
    return NextResponse.json(
      { error: "This note is published and cannot be regenerated." },
      { status: 409 },
    );
  }
  if (!insight.ticker) {
    return NextResponse.json(
      { error: "Only pick and exit notes can be generated from facts." },
      { status: 400 },
    );
  }

  try {
    // An exit note is drafted from a different facts bundle and a different
    // prompt, and its slug must not move — see regenerateExitInsight.
    if (insight.postType === "exit") {
      await regenerateExitInsight(id, insight.ticker, insight.slug);
    } else {
      await regenerateInsight(id, insight.ticker);
    }
  } catch (e) {
    // regenerateInsight already recorded this against the row, so the queue
    // shows it too — this just surfaces it to the admin who clicked.
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Generation failed" },
      { status: 502 },
    );
  }

  return NextResponse.json({ insight: await getInsightById(id) });
}
