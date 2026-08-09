import { announcePick } from "@/lib/pick-announce";
import { claimForPublish, listDraftsDueForPublish } from "@/lib/insights-db";
import { autoPublishEnabled } from "@/lib/review-window";

/**
 * Publish and announce drafts whose review window has run out.
 *
 * The review gate used to be a human pressing a button, and nothing told that
 * human a draft was waiting — so a pick could sit unannounced indefinitely.
 * This inverts the default: a note ships unless someone stops it. Rejecting is
 * the stop (see `rejectInsight`), and `AUTO_PUBLISH_ENABLED=false` halts every
 * note at once without a deploy.
 *
 * The consequence, stated plainly because it is the point of the design: a
 * draft nobody reads gets mailed to the list. The window is the only thing
 * standing between a bad generation and every subscriber.
 *
 * Two properties do the safety work, and both are borrowed rather than
 * reimplemented:
 *
 *  - `claimForPublish` is the same single conditional UPDATE the approve button
 *    uses. An admin approving at the moment the sweep fires, two overlapping
 *    sweeps, a retried request — exactly one wins the row and only the winner
 *    sends. This is why the auto path must never have its own publish query.
 *  - `listDraftsDueForPublish` filters out incomplete rows in SQL, so a note
 *    with no body is never even a candidate.
 *
 * Failures are per-note. One ticker that cannot be announced must not strand
 * the others, and a note that was claimed but whose send partly failed is
 * reported, not rolled back — there is no un-send.
 */

export type AutoPublishResult = {
  published: { ticker: string; slug: string; sent: number; failed: number }[];
  /** Due, but lost the claim — already approved or rejected between the
   *  SELECT and the UPDATE. Expected, not an error. */
  skipped: { ticker: string; reason: string }[];
  errors: { ticker: string; error: string }[];
  disabled?: true;
};

export async function autoPublishDueDrafts(): Promise<AutoPublishResult> {
  const result: AutoPublishResult = {
    published: [],
    skipped: [],
    errors: [],
  };

  if (!autoPublishEnabled()) {
    return { ...result, disabled: true };
  }
  if (!process.env.RESEND_API_KEY) {
    // Matches the approve route's refusal. Claiming the row without a mailer
    // configured would burn the one chance to announce the note: the claim is
    // irreversible but no email would leave.
    result.errors.push({
      ticker: "*",
      error: "RESEND_API_KEY is not set; refusing to publish without it",
    });
    return result;
  }

  const due = await listDraftsDueForPublish();

  // Sequential. Each note fans out to the whole list through a rate-limited
  // mailer, and running two at once buys nothing but a 429.
  for (const meta of due) {
    const ticker = meta.ticker ?? "—";
    try {
      const claimed = await claimForPublish(meta.id);
      if (!claimed) {
        result.skipped.push({
          ticker,
          reason: "no longer an unsent draft",
        });
        continue;
      }
      const sent = await announcePick({
        ticker: claimed.ticker!,
        title: claimed.title!,
        description: claimed.description!,
        insightSlug: claimed.slug,
      });
      result.published.push({
        ticker,
        slug: claimed.slug,
        sent: sent.sent,
        failed: sent.failed,
      });
    } catch (e) {
      result.errors.push({
        ticker,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }

  return result;
}
