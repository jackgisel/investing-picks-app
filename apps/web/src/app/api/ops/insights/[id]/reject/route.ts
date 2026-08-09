import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { ensureMigrations } from "@/lib/auth";
import { getInsightById, rejectInsight } from "@/lib/insights-db";

export const dynamic = "force-dynamic";

/**
 * Stop a draft from publishing itself.
 *
 * The counterweight to the auto-publisher: drafts ship on a timer, so this is
 * the only thing that keeps one from going out. It clears the deadline and
 * moves the row out of `draft`, which is the state the sweep selects on.
 *
 * Not destructive — the body is untouched and `Regenerate` puts the note back
 * into `draft` with a fresh window.
 */
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  await ensureMigrations();
  const { id } = await params;

  const rejected = await rejectInsight(id);
  if (rejected) {
    return NextResponse.json({ ok: true, insight: rejected });
  }

  // The UPDATE matched nothing. Say which of the reasons it was — "already
  // sent" and "does not exist" call for very different reactions from whoever
  // just pressed the button.
  const existing = await getInsightById(id);
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json(
    {
      error:
        existing.emailSentAt !== null
          ? "Too late — this note was already announced to subscribers. There is no un-send."
          : `Only a draft can be rejected; this note is '${existing.status}'.`,
      alreadySent: existing.emailSentAt !== null,
    },
    { status: 409 },
  );
}
