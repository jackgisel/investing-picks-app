import { NextResponse } from "next/server";
import { adminEmails } from "@/lib/admin";
import { ensureMigrations } from "@/lib/auth";
import { isoWeekKey } from "@/lib/email-dispatch";
import { sendMarketNoteOpsEmail } from "@/lib/email";
import { requireInternalSecret } from "@/lib/internal-auth";
import { draftMarketNoteBrief } from "@/lib/market-note-brief";
import { ensureIssue, getSendableIssue, saveIssue } from "@/lib/market-note-issue";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * The reminder tick, a couple of days before the Monday send.
 *
 * Opens the row for the coming week and has the model write the first draft
 * from the scoring snapshot and web research, so the compose page holds
 * something to review rather than a blank form. The draft is never confirmed:
 * a person reads it and confirms, or Monday skips. Mails the admins only when
 * nothing is actually ready, since a reminder that fires every week regardless
 * of state is a reminder people stop reading.
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

    const issue = await ensureIssue(weekKey, `Monday market note — ${weekKey}`);

    let drafted = false;
    let draftError: string | null = null;
    if (!issue.sentAt && !issue.bodyMd?.trim()) {
      try {
        const draft = await draftMarketNoteBrief();
        const saved = await saveIssue(issue.id, {
          subject: draft.subject,
          lede: draft.lede,
          bodyMd: null,
          watchlist: draft.watchlist,
          sectorsMd: draft.sectorsMd,
          sentimentMd: draft.sentimentMd,
          newsMd: draft.newsMd,
          dates: draft.dates,
        });
        drafted = Boolean(saved);
      } catch (e) {
        draftError = e instanceof Error ? e.message : "Draft failed";
      }
    }

    const ready = await getSendableIssue();

    if (!ready) {
      await sendMarketNoteOpsEmail({
        to: adminEmails(),
        kind: "reminder",
        weekKey,
        detail: draftError
          ? `The AI draft failed (${draftError}). Open the compose page and redraft, or write it by hand.`
          : drafted
            ? "The AI draft is written and waiting for your review. Read it, edit what you want, and confirm it before Monday 6:00 AM PT."
            : undefined,
      });
    }

    return NextResponse.json({
      weekKey,
      issueId: issue.id,
      ready: Boolean(ready),
      drafted,
      draftError,
      reminded: !ready,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Market Note prepare failed" },
      { status: 502 },
    );
  }
}
