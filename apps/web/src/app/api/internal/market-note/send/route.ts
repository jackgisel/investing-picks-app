import { NextResponse } from "next/server";
import { adminEmails } from "@/lib/admin";
import { ensureMigrations } from "@/lib/auth";
import { isoWeekKey } from "@/lib/email-dispatch";
import { sendMarketNoteOpsEmail } from "@/lib/email";
import { requireInternalSecret } from "@/lib/internal-auth";
import { sendDueMarketNote } from "@/lib/market-note-send";

export const dynamic = "force-dynamic";

/**
 * The worker's Monday tick.
 *
 * Sends whatever issue is confirmed and waiting. A week where nobody wrote one
 * is a skip, not a failure: the list hears nothing and the admins get told.
 * Mailing a half-written note on a schedule would be worse than missing a week,
 * so the confirm gate is never bypassed here.
 */
export async function POST(req: Request) {
  const guard = requireInternalSecret(req);
  if (!guard.ok) return guard.response;

  if (!process.env.RESEND_API_KEY) {
    return NextResponse.json(
      { error: "RESEND_API_KEY is not set; refusing to send without it" },
      { status: 503 },
    );
  }

  await ensureMigrations();
  try {
    const result = await sendDueMarketNote();
    const weekKey = result.weekKey ?? isoWeekKey();

    if (result.skipped) {
      await sendMarketNoteOpsEmail({
        to: adminEmails(),
        kind: "skipped",
        weekKey,
        detail: `Nothing was mailed — ${result.skipped}.`,
      });
      return NextResponse.json(result);
    }

    await sendMarketNoteOpsEmail({
      to: adminEmails(),
      kind: "sent",
      weekKey,
      detail: `"${result.subject}" went to ${result.sent} of ${result.total} subscribers${
        result.failed ? `, ${result.failed} failed` : ""
      }.`,
    });
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Market Note send failed" },
      { status: 502 },
    );
  }
}
