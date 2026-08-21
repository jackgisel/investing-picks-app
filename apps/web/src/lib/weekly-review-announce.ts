import { sendWeeklyReviewEmail } from "@/lib/email";
import { getOptedInRecipients } from "@/lib/preferences";

/**
 * Mail every opted-in member about this week's review.
 *
 * Shared by the noon job and the late-confirm "send now" path so the two
 * cannot drift. This function does NOT decide whether sending is allowed —
 * the caller owns that, and it means claiming `email_sent_at` first.
 */

export type AnnounceResult = {
  sent: number;
  failed: number;
  total: number;
  errors: { email: string; error: string }[];
};

export async function announceWeeklyReview(args: {
  title: string;
  lede: string;
  insightSlug: string;
}): Promise<AnnounceResult> {
  const recipients = await getOptedInRecipients("weeklySummary");
  if (recipients.length === 0) {
    return { sent: 0, failed: 0, total: 0, errors: [] };
  }

  const CHUNK = 5;
  let sent = 0;
  let failed = 0;
  const errors: { email: string; error: string }[] = [];

  for (let i = 0; i < recipients.length; i += CHUNK) {
    const results = await Promise.all(
      recipients.slice(i, i + CHUNK).map((r) =>
        sendWeeklyReviewEmail({
          to: r.email,
          userId: r.id,
          recipientName: r.name,
          title: args.title,
          lede: args.lede,
          insightSlug: args.insightSlug,
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

  return { sent, failed, total: recipients.length, errors };
}
