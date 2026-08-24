import { claimDispatch, isoWeekKey } from "@/lib/email-dispatch";
import { sendMarketNoteIssueEmail } from "@/lib/email";
import { listActiveSubscribers } from "@/lib/market-note";
import {
  claimIssueForSend,
  getIssueById,
  getSendableIssue,
} from "@/lib/market-note-issue";

/**
 * Mail one issue of the Market Note to the whole free list.
 *
 * Two independent locks, on purpose. `claimIssueForSend` is the conditional
 * UPDATE that stamps `sent_at` — it is what stops a double-clicked button from
 * mailing twice. `claimDispatch` is the shared ledger every other recurring
 * send uses, keyed by ISO week, and it catches the case where someone deletes
 * or recreates the row. Either one alone would be enough on a good day; the
 * cost of being wrong here is a duplicate mailing to the entire list, and there
 * is no un-send.
 *
 * Both claims happen BEFORE the first message leaves. A crash mid-send leaves
 * an issue marked sent and partially delivered — visible and recoverable. The
 * reverse leaves one that looks unsent and can be mailed again from scratch.
 */

export type SendIssueResult = {
  ok: boolean;
  sent: number;
  failed: number;
  total: number;
  errors: { email: string; error: string }[];
  skipped?: string;
};

export async function sendMarketNoteIssue(
  id: string,
): Promise<SendIssueResult> {
  const empty = { sent: 0, failed: 0, total: 0, errors: [] };

  const issue = await getIssueById(id);
  if (!issue) return { ok: false, ...empty, skipped: "no such issue" };
  if (issue.sentAt) {
    return { ok: false, ...empty, skipped: "already sent" };
  }
  if (!issue.confirmedAt) {
    return { ok: false, ...empty, skipped: "not confirmed" };
  }
  if (!issue.bodyMd?.trim()) {
    return { ok: false, ...empty, skipped: "no body" };
  }

  const recipients = await listActiveSubscribers();
  if (recipients.length === 0) {
    return { ok: false, ...empty, skipped: "no active subscribers" };
  }

  if (!(await claimDispatch("market_note", issue.weekKey, recipients.length))) {
    return { ok: false, ...empty, skipped: "already dispatched this week" };
  }

  const claimed = await claimIssueForSend(id, recipients.length);
  if (!claimed) {
    return { ok: false, ...empty, skipped: "no longer sendable" };
  }

  const weekKey = issue.weekKey || isoWeekKey();
  const body = claimed.bodyMd!;

  // Resend's free tier is ~2 req/sec; chunks of 5 with awaits is conservative.
  const CHUNK = 5;
  let sent = 0;
  let failed = 0;
  const errors: { email: string; error: string }[] = [];

  for (let i = 0; i < recipients.length; i += CHUNK) {
    const results = await Promise.all(
      recipients.slice(i, i + CHUNK).map((r) =>
        sendMarketNoteIssueEmail({
          to: r.email,
          token: r.token,
          subject: claimed.subject,
          lede: claimed.lede,
          bodyMd: body,
          weekKey,
        }).then((res) => ({ email: r.email, ...res })),
      ),
    );
    for (const r of results) {
      if (r.ok) sent += 1;
      else {
        failed += 1;
        errors.push({ email: r.email, error: r.error ?? "unknown" });
      }
    }
  }

  return { ok: failed === 0, sent, failed, total: recipients.length, errors };
}

/**
 * The Monday job: send whatever is confirmed and waiting.
 *
 * Returns a skip rather than throwing when there is nothing to send. A week
 * where nobody wrote the note is a normal outcome, not a failure — the caller
 * tells the admins and the worker stays up.
 */
export async function sendDueMarketNote(): Promise<
  SendIssueResult & { weekKey?: string; subject?: string }
> {
  const due = await getSendableIssue();
  if (!due) {
    return {
      ok: false,
      sent: 0,
      failed: 0,
      total: 0,
      errors: [],
      skipped: "no confirmed issue waiting",
    };
  }
  const result = await sendMarketNoteIssue(due.id);
  return { ...result, weekKey: due.weekKey, subject: due.subject };
}
