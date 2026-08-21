import { NextResponse } from "next/server";
import { ensureMigrations } from "@/lib/auth";
import { requireInternalSecret } from "@/lib/internal-auth";
import { publishWeeklyReview } from "@/lib/weekly-review-sync";

export const dynamic = "force-dynamic";

/**
 * The worker's Friday noon PT tick.
 *
 * Confirmed drafts publish and email paid subscribers. Unconfirmed drafts
 * stay in ops and the admins get a skip mail. Already-sent is a no-op.
 */
export async function POST(req: Request) {
  const guard = requireInternalSecret(req);
  if (!guard.ok) return guard.response;

  await ensureMigrations();
  try {
    const result = await publishWeeklyReview();
    if (result.skipped === "no_mailer") {
      return NextResponse.json(result, { status: 503 });
    }
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json(
      {
        error: e instanceof Error ? e.message : "Weekly review publish failed",
      },
      { status: 502 },
    );
  }
}
