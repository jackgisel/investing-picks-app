import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { ensureMigrations } from "@/lib/auth";
import { announceExit, announcePick } from "@/lib/pick-announce";
import { claimForPublish, getInsightById } from "@/lib/insights-db";

export const dynamic = "force-dynamic";

/**
 * Publish a note and announce it. One gate, one irreversible act.
 *
 * The ordering is the whole design:
 *
 *  1. `claimForPublish` flips the status AND stamps `email_sent_at` in a single
 *     conditional UPDATE. Exactly one caller can win that statement.
 *  2. Only the winner sends.
 *
 * Claiming before dispatch, rather than marking sent afterwards, is deliberate.
 * If this process dies mid-send the note is published and partially announced —
 * recoverable, and visible. If the claim came after, a crash would leave a note
 * that looks unsent and can be announced again from scratch, which is not
 * recoverable, because there is no un-send.
 *
 * A partial send is therefore reported, not rolled back. The failures are
 * listed so they can be chased individually.
 */
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  if (!process.env.RESEND_API_KEY) {
    return NextResponse.json(
      { error: "RESEND_API_KEY is not set; refusing to publish without it" },
      { status: 503 },
    );
  }

  await ensureMigrations();
  const { id } = await params;

  const before = await getInsightById(id);
  if (!before) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  // Cheap pre-checks so the common mistakes get a useful message. They are NOT
  // the safety property — the conditional UPDATE below is, and it re-checks
  // everything under a lock the database holds.
  if (!before.title || !before.description || !before.bodyMd) {
    return NextResponse.json(
      { error: "Fill in the title, description and body before approving." },
      { status: 400 },
    );
  }
  if (!before.ticker) {
    return NextResponse.json(
      { error: "Only pick and exit notes can be announced." },
      { status: 400 },
    );
  }

  const claimed = await claimForPublish(id);
  if (!claimed) {
    return NextResponse.json(
      {
        error:
          before.emailSentAt !== null
            ? "Already announced. Subscribers were emailed about this note; it will not be sent again."
            : `Cannot approve a note with status '${before.status}'.`,
        alreadySent: before.emailSentAt !== null,
      },
      { status: 409 },
    );
  }

  const result =
    claimed.postType === "exit"
      ? await announceExit({
          ticker: claimed.ticker!,
          title: claimed.title!,
          description: claimed.description!,
          insightSlug: claimed.slug,
        })
      : await announcePick({
          ticker: claimed.ticker!,
          title: claimed.title!,
          description: claimed.description!,
          insightSlug: claimed.slug,
        });

  return NextResponse.json({
    ok: result.failed === 0,
    published: true,
    slug: claimed.slug,
    ...result,
  });
}
