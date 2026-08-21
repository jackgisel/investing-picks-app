import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { ensureMigrations } from "@/lib/auth";
import { isoWeekKey } from "@/lib/email-dispatch";
import { weeklyReviewSlug } from "@/lib/insights";
import {
  getInsightById,
  getInsightBySlug,
  unconfirmWeeklyReview,
} from "@/lib/insights-db";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  await ensureMigrations();
  const body = await req.json().catch(() => ({} as { id?: unknown }));
  const id =
    typeof body.id === "string" && body.id
      ? body.id
      : (
          await getInsightBySlug(weeklyReviewSlug(isoWeekKey()), {
            includeUnpublished: true,
          })
        )?.id;

  if (!id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const updated = await unconfirmWeeklyReview(id);
  if (updated) {
    return NextResponse.json({ ok: true, insight: updated });
  }

  const existing = await getInsightById(id);
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json(
    {
      error:
        existing.emailSentAt !== null
          ? "Too late — this review was already sent. There is no un-send."
          : existing.confirmedAt
            ? `Cannot unconfirm a note with status '${existing.status}'.`
            : "This review is not confirmed.",
      alreadySent: existing.emailSentAt !== null,
    },
    { status: 409 },
  );
}
