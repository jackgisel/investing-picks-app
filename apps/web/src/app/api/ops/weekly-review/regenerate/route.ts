import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { ensureMigrations } from "@/lib/auth";
import { isoWeekKey } from "@/lib/email-dispatch";
import { weeklyReviewSlug } from "@/lib/insights";
import { getInsightById, getInsightBySlug } from "@/lib/insights-db";
import { draftWeeklyReview } from "@/lib/weekly-review-sync";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** Rewrite the draft. Clears confirm. Refuses an already-published review. */
export async function POST(req: Request) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  await ensureMigrations();
  const body = await req.json().catch(() => ({} as { id?: unknown }));
  const existing =
    typeof body.id === "string" && body.id
      ? await getInsightById(body.id)
      : await getInsightBySlug(weeklyReviewSlug(isoWeekKey()), {
          includeUnpublished: true,
        });

  if (!existing || existing.postType !== "weekly_review") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (existing.status === "approved") {
    return NextResponse.json(
      { error: "This review is published and cannot be regenerated." },
      { status: 409 },
    );
  }

  try {
    const result = await draftWeeklyReview({ force: true });
    if (result.error) {
      return NextResponse.json(result, { status: 502 });
    }
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Generation failed" },
      { status: 502 },
    );
  }
}
