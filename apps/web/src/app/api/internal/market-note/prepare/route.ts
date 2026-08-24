import { NextResponse } from "next/server";
import { adminEmails } from "@/lib/admin";
import { ensureMigrations } from "@/lib/auth";
import { isoWeekKey } from "@/lib/email-dispatch";
import { sendMarketNoteOpsEmail } from "@/lib/email";
import { requireInternalSecret } from "@/lib/internal-auth";
import { ensureIssue, getSendableIssue } from "@/lib/market-note-issue";

export const dynamic = "force-dynamic";

/**
 * The reminder tick, a couple of days before the Monday send.
 *
 * Opens the row for the coming week so the compose page is never a blank
 * "start an issue" button on the morning it is needed, and mails the admins
 * only when nothing is actually ready. A reminder that fires every week
 * regardless of state is a reminder people stop reading.
 */
export async function POST(req: Request) {
  const guard = requireInternalSecret(req);
  if (!guard.ok) return guard.response;

  await ensureMigrations();
  try {
    // The issue this reminder is about is the one MONDAY will send, and ISO
    // weeks turn over on that Monday — so key it to the upcoming week, not the
    // one that is currently ending.
    const monday = new Date();
    monday.setUTCDate(monday.getUTCDate() + 2);
    const weekKey = isoWeekKey(monday);

    const issue = await ensureIssue(weekKey, `Market Note — ${weekKey}`);
    const ready = await getSendableIssue();

    if (!ready) {
      await sendMarketNoteOpsEmail({
        to: adminEmails(),
        kind: "reminder",
        weekKey,
      });
    }

    return NextResponse.json({
      weekKey,
      issueId: issue.id,
      ready: Boolean(ready),
      reminded: !ready,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Market Note prepare failed" },
      { status: 502 },
    );
  }
}
