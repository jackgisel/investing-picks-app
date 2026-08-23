import { sendNewPickEmail } from "@/lib/email";
import type { PickStat } from "@/lib/email-templates";
import { getOptedInRecipients } from "@/lib/preferences";
import { formatStreetPrice } from "@/lib/street-range";
import { fetchStreetRangeForTicker } from "@/lib/street-range-server";

/**
 * Mail every opted-in member about a pick.
 *
 * Shared by the approve button and the manual `notify-pick` route so the two
 * cannot drift — the chunking, the per-recipient error collection and the
 * unsubscribe token all have to behave identically whichever one fires.
 *
 * This function does NOT decide whether sending is allowed. The caller owns
 * that, and for the approve path it means claiming `email_sent_at` first (see
 * `claimForPublish`). Nothing here is idempotent; call it twice and the list
 * gets two emails.
 */

export type AnnounceResult = {
  sent: number;
  failed: number;
  total: number;
  errors: { email: string; error: string }[];
};

export async function announcePick(args: {
  ticker: string;
  title: string;
  description: string;
  insightSlug: string;
}): Promise<AnnounceResult> {
  const recipients = await getOptedInRecipients("newPicks");
  if (recipients.length === 0) {
    return { sent: 0, failed: 0, total: 0, errors: [] };
  }

  const street = await fetchStreetRangeForTicker(args.ticker);
  const stats: PickStat[] = [];
  if (street) {
    if (street.mark !== null) {
      stats.push({ label: "Mark", value: formatStreetPrice(street.mark) });
    }
    stats.push({ label: "Street low", value: formatStreetPrice(street.low) });
    stats.push({
      label: "Street mean",
      value: formatStreetPrice(street.mean),
    });
    stats.push({ label: "Street high", value: formatStreetPrice(street.high) });
  }

  // Resend's free tier is ~2 req/sec; chunks of 5 with awaits is conservative.
  const CHUNK = 5;
  let sent = 0;
  let failed = 0;
  const errors: { email: string; error: string }[] = [];

  for (let i = 0; i < recipients.length; i += CHUNK) {
    const results = await Promise.all(
      recipients.slice(i, i + CHUNK).map((r) =>
        sendNewPickEmail({
          to: r.email,
          userId: r.id,
          recipientName: r.name,
          ticker: args.ticker,
          stats: stats.length ? stats : undefined,
          articleTitle: args.title,
          articleDescription: args.description,
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
