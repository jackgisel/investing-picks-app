import { SITE_URL } from "@/lib/constants";

/**
 * Shared conventions for AI-drafted research notes, weekly reviews, and any
 * subscriber-facing copy that cites the same facts.
 *
 * Kept out of the individual draft modules so a prompt tweak (scale of the
 * rating, where the explainer lives, how a date reads) cannot drift between
 * pick notes and Friday reviews.
 */

/** Quant ratings are always on a closed 1.0–5.0 scale. */
export const QUANT_RATING_MIN = 1;
export const QUANT_RATING_MAX = 5;

/**
 * Member page that explains what the rating measures. Deep-linked from every
 * place a draft cites a number so "4.2" is never a free-floating score.
 */
export const QUANT_RATING_EXPLAINER_PATH = "/dashboard/strategy#quant-rating";

export function quantRatingExplainerUrl(siteUrl: string = SITE_URL): string {
  return `${siteUrl}${QUANT_RATING_EXPLAINER_PATH}`;
}

/** Reader-facing form: "4.2 / 5". Null when unscored. */
export function formatQuantRating(
  rating: number | null | undefined,
): string | null {
  if (typeof rating !== "number" || !Number.isFinite(rating)) return null;
  const rounded = Math.round(rating * 10) / 10;
  const text = Number.isInteger(rounded)
    ? String(rounded)
    : rounded.toFixed(1);
  return `${text} / ${QUANT_RATING_MAX}`;
}

/**
 * Block injected into every drafting STYLE_GUIDE so pick notes and weekly
 * reviews cite ratings the same way.
 */
export function quantRatingPromptRules(siteUrl: string = SITE_URL): string {
  const url = quantRatingExplainerUrl(siteUrl);
  return `## Quant ratings
- Quant ratings are scored on a ${QUANT_RATING_MIN}–${QUANT_RATING_MAX} scale. Whenever you mention one, write it as \`X.X / ${QUANT_RATING_MAX}\` (for example \`4.2 / ${QUANT_RATING_MAX}\`), never as a bare number.
- The first time a note cites a quant rating, link the phrase to ${url} so the reader can see what the scale measures. Later mentions in the same note may omit the link.
- Do not invent a rating that is absent from the payload.`;
}

/**
 * Block injected into drafting STYLE_GUIDEs for dates and visuals.
 * American month-first forms only — never day-first European.
 */
export const CONTENT_DATE_AND_VISUAL_RULES = `## Dates
- Write every human-facing date in American form: month before day (August 9, 2026; Aug 3–9, 2026; Monday, August 3). Never day-first European forms (9 August, 3–9 August).
- Prefer the period_label and \`when\` strings from the payload when they are present — they are already American.

## Visuals
- Prefer a compact GitHub-flavoured markdown table when it clarifies a comparison the prose would bury: the five factor grades for a pick, or the week's largest movers by return. One short table beats a wall of numbers.
- Do not invent chart images, data URIs, or external image URLs. Tables and prose only.
- Still no code fences except a plain markdown table. No mermaid, no HTML.`;
