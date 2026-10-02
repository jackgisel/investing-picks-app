import {
  announceAdd,
  announceExit,
  announcePick,
  announcePickCycle,
} from "@/lib/pick-announce";
import { claimForPublish, listDraftsDueForPublish } from "@/lib/insights-db";
import { addDateFromSlug, shouldAnnounceAdd } from "@/lib/insights";
import {
  claimCycleSiblings,
  fetchRecentTrades,
  openCycleSiblings,
  siblingStillComing,
} from "@/lib/pick-cycle";
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

/**
 * Longest a due pick waits on a cycle sibling before going out alone. Long
 * enough to cover a second note drafted a day later, short enough that a
 * sibling stuck generating cannot sit on a pick for the whole cycle.
 */
export const MAX_CYCLE_HOLD_MS = 24 * 60 * 60 * 1000;

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
  const dueIds = new Set(due.map((d) => d.id));
  // Notes already claimed as part of an earlier note's cycle mail this sweep.
  const handled = new Set<string>();
  const trades = due.some((d) => d.postType === "pick")
    ? await fetchRecentTrades()
    : [];

  // Sequential. Each note fans out to the whole list through a rate-limited
  // mailer, and running two at once buys nothing but a 429.
  for (const meta of due) {
    if (handled.has(meta.id)) continue;
    const ticker = meta.ticker ?? "—";
    try {
      if (meta.postType === "pick" && meta.ticker) {
        // A multi-pick cycle sends one mail. Hold this note while a sibling is
        // still in review; once every sibling is due, the first one through
        // here claims the rest and mails them together.
        const siblings = await openCycleSiblings(meta.ticker, trades);
        const overdueBy = meta.autoPublishAt
          ? Date.now() - new Date(meta.autoPublishAt).getTime()
          : 0;
        const waitingOn = siblings.filter(
          (s) => !dueIds.has(s.id) && siblingStillComing(s),
        );
        if (waitingOn.length && overdueBy < MAX_CYCLE_HOLD_MS) {
          result.skipped.push({
            ticker,
            reason: `held to send with ${waitingOn.map((s) => s.ticker).join(", ")}`,
          });
          continue;
        }
        const claimed = await claimForPublish(meta.id);
        if (!claimed) {
          result.skipped.push({ ticker, reason: "no longer an unsent draft" });
          continue;
        }
        const partners = await claimCycleSiblings(
          siblings.filter((s) => dueIds.has(s.id)),
        );
        for (const p of partners) handled.add(p.id);
        const sent = partners.length
          ? await announcePickCycle([claimed, ...partners])
          : await announcePick({
              ticker: claimed.ticker!,
              title: claimed.title!,
              description: claimed.description!,
              insightSlug: claimed.slug,
            });
        for (const n of [claimed, ...partners]) {
          result.published.push({
            ticker: n.ticker ?? "—",
            slug: n.slug,
            sent: sent.sent,
            failed: sent.failed,
          });
        }
        continue;
      }

      const claimed = await claimForPublish(meta.id);
      if (!claimed) {
        result.skipped.push({
          ticker,
          reason: "no longer an unsent draft",
        });
        continue;
      }
      const sent =
        claimed.postType === "exit"
          ? await announceExit({
              ticker: claimed.ticker!,
              title: claimed.title!,
              description: claimed.description!,
              insightSlug: claimed.slug,
            })
          : claimed.postType === "add" &&
              shouldAnnounceAdd(addDateFromSlug(claimed.slug))
            ? await announceAdd({
                ticker: claimed.ticker!,
                title: claimed.title!,
                description: claimed.description!,
                insightSlug: claimed.slug,
              })
            : claimed.postType === "add"
              ? { sent: 0, failed: 0, total: 0, errors: [] }
              : await announcePick({
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
