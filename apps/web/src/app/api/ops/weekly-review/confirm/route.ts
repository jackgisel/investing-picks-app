import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { ensureMigrations } from "@/lib/auth";
import { isoWeekKey } from "@/lib/email-dispatch";
import { weeklyReviewSlug } from "@/lib/insights";
import {
  confirmWeeklyReview,
  getInsightById,
  getInsightBySlug,
} from "@/lib/insights-db";
import { isPastFridayNoon } from "@/lib/weekly-review";
import { publishWeeklyReview } from "@/lib/weekly-review-sync";

export const dynamic = "force-dynamic";

async function currentWeekInsight() {
  return getInsightBySlug(weeklyReviewSlug(isoWeekKey()), {
    includeUnpublished: true,
  });
}

/**
 * Arm the Friday send. If noon PT has already passed, publish immediately.
 *
 * Confirm does not itself mail anyone before noon — it only stamps
 * `confirmed_at`. The noon job (or the late path below) is what sends.
 */
export async function POST(req: Request) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  await ensureMigrations();
  const body = await req.json().catch(() => ({} as { id?: unknown }));
  const id =
    typeof body.id === "string" && body.id
      ? body.id
      : (await currentWeekInsight())?.id;

  if (!id) {
    return NextResponse.json(
      { error: "No weekly review to confirm. Draft one first." },
      { status: 404 },
    );
  }

  const before = await getInsightById(id);
  if (!before || before.postType !== "weekly_review") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (!before.title || !before.description || !before.bodyMd) {
    return NextResponse.json(
      { error: "Fill in the title, description and body before confirming." },
      { status: 400 },
    );
  }

  const confirmed = await confirmWeeklyReview(id);
  if (!confirmed) {
    return NextResponse.json(
      {
        error:
          before.emailSentAt !== null
            ? "Already published. Subscribers were emailed this review."
            : `Only a draft can be confirmed; this note is '${before.status}'.`,
        alreadySent: before.emailSentAt !== null,
      },
      { status: 409 },
    );
  }

  const sendAt = confirmed.autoPublishAt
    ? new Date(confirmed.autoPublishAt)
    : null;
  const due =
    (sendAt !== null && Date.now() >= sendAt.getTime()) || isPastFridayNoon();

  if (!due) {
    return NextResponse.json({
      ok: true,
      published: false,
      insight: confirmed,
    });
  }

  if (!process.env.RESEND_API_KEY) {
    return NextResponse.json(
      {
        error:
          "Confirmed, but RESEND_API_KEY is not set; refusing to publish without it.",
        insight: confirmed,
      },
      { status: 503 },
    );
  }

  const published = await publishWeeklyReview({
    id,
    notifyIfUnconfirmed: false,
  });
  return NextResponse.json({
    ok: published.skipped == null && (published.failed ?? 0) === 0,
    published: published.skipped == null,
    insight: await getInsightById(id),
    ...published,
  });
}
