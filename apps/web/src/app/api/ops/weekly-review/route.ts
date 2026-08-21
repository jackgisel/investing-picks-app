import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { ensureMigrations } from "@/lib/auth";
import { isoWeekKey } from "@/lib/email-dispatch";
import { weeklyReviewSlug } from "@/lib/insights";
import { getInsightBySlug, listWeeklyReviews } from "@/lib/insights-db";
import { fridayNoonLabel, fridayNoonPacific } from "@/lib/weekly-review";
import { draftWeeklyReview } from "@/lib/weekly-review-sync";
import { periodLabel } from "@/lib/weekly-summary";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** This week's review plus history. */
export async function GET() {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  await ensureMigrations();
  const now = new Date();
  const weekKey = isoWeekKey(now);
  const current = await getInsightBySlug(weeklyReviewSlug(weekKey), {
    includeUnpublished: true,
  });
  const history = (await listWeeklyReviews()).filter(
    (m) => m.slug !== current?.slug,
  );

  return NextResponse.json({
    weekKey,
    periodLabel: periodLabel(now),
    sendAt: fridayNoonPacific(now).toISOString(),
    sendAtLabel: fridayNoonLabel(now),
    current,
    history,
  });
}

/**
 * Draft this week's review by hand. Same work the Friday 10am job does.
 *
 * `{ force: true }` regenerates and clears confirm — the UI confirms first.
 */
export async function POST(req: Request) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  await ensureMigrations();
  const body = await req.json().catch(() => ({} as { force?: unknown }));
  const force = body.force === true;

  try {
    const result = await draftWeeklyReview({ force });
    if (result.error) {
      return NextResponse.json(result, { status: 502 });
    }
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Draft failed" },
      { status: 502 },
    );
  }
}
