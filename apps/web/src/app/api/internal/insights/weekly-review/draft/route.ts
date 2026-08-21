import { NextResponse } from "next/server";
import { ensureMigrations } from "@/lib/auth";
import { requireInternalSecret } from "@/lib/internal-auth";
import { draftWeeklyReview } from "@/lib/weekly-review-sync";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * The worker's Friday 10am PT tick. Drafts this week's review and emails
 * the admins that it is waiting. Does not publish, does not mail members.
 *
 * Safe to call twice: a draft that already has a body is left alone so an
 * admin's edits survive a redeploy that re-fires the job.
 */
export async function POST(req: Request) {
  const guard = requireInternalSecret(req);
  if (!guard.ok) return guard.response;

  await ensureMigrations();
  try {
    const result = await draftWeeklyReview();
    if (result.error) {
      return NextResponse.json(result, { status: 502 });
    }
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Weekly review draft failed" },
      { status: 502 },
    );
  }
}
