/**
 * How long a drafted note sits before it publishes itself.
 *
 * Its own module rather than a constant in either place that needs it:
 * `insights-db` stamps the deadline and `insight-auto-publish` acts on it, and
 * having the second import the first would make the pair circular.
 *
 * Not in `lib/constants.ts` because that file is imported by client components
 * and this reads server-only env.
 */

/** Hours of review before the sweep may announce a draft. */
export const DEFAULT_REVIEW_WINDOW_HOURS = 24;

/**
 * The configured window, in hours.
 *
 * `INSIGHT_REVIEW_WINDOW_HOURS=0` is legal and means "announce on the next
 * sweep" — useful for a staging deploy, and the reason the floor is 0 rather
 * than something that pretends to protect you. A negative or unparseable value
 * falls back to the default instead of throwing: this is read on the drafting
 * path, and a typo in an env var should not cost a cycle's notes.
 */
export function reviewWindowHours(): number {
  const raw = process.env.INSIGHT_REVIEW_WINDOW_HOURS;
  if (raw === undefined || raw.trim() === "") return DEFAULT_REVIEW_WINDOW_HOURS;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed < 0) {
    console.warn(
      `INSIGHT_REVIEW_WINDOW_HOURS="${raw}" is not a non-negative number; using ${DEFAULT_REVIEW_WINDOW_HOURS}h`,
    );
    return DEFAULT_REVIEW_WINDOW_HOURS;
  }
  return parsed;
}

/**
 * The kill switch. Set `AUTO_PUBLISH_ENABLED=false` to stop the sweep dead
 * without a deploy — drafts keep accumulating and wait for the approve button.
 *
 * Defaults to on: the whole point of the feature is that a note ships when
 * nobody is watching, so a missing variable must not silently disable it.
 */
export function autoPublishEnabled(): boolean {
  const raw = (process.env.AUTO_PUBLISH_ENABLED ?? "").trim().toLowerCase();
  return raw !== "false" && raw !== "0" && raw !== "off";
}
