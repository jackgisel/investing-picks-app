/**
 * The six decorative pastels, as an ordered ring.
 *
 * These are *surface* colors. They carry ~1.6:1 against white, so they must
 * never tint glyphs — text on a toned element stays `text-on-accent` (when it
 * sits on the pastel) or `text-text` (when it sits beside it). Use these for
 * backgrounds, borders, rules, and dots only.
 *
 * The values are identical in light and dark (see globals.css) — they're
 * mid-tones chosen to hold up on both grounds.
 */
export const TONES = ["yellow", "peach", "lilac", "mint", "coral", "cyan"] as const;

export type PastelTone = (typeof TONES)[number];

/** Tailwind scans source statically, so every class is written out in full. */
export const TONE_BG: Record<PastelTone, string> = {
  yellow: "bg-accent-yellow",
  peach: "bg-accent-peach",
  lilac: "bg-accent-lilac",
  mint: "bg-accent-mint",
  coral: "bg-accent-coral",
  cyan: "bg-accent-cyan",
};

export const TONE_BORDER: Record<PastelTone, string> = {
  yellow: "border-accent-yellow",
  peach: "border-accent-peach",
  lilac: "border-accent-lilac",
  mint: "border-accent-mint",
  coral: "border-accent-coral",
  cyan: "border-accent-cyan",
};

/** A wash faint enough to sit under body text in either theme. */
export const TONE_TINT: Record<PastelTone, string> = {
  yellow: "bg-accent-yellow/15",
  peach: "bg-accent-peach/15",
  lilac: "bg-accent-lilac/15",
  mint: "bg-accent-mint/15",
  coral: "bg-accent-coral/15",
  cyan: "bg-accent-cyan/15",
};

/**
 * Cycle the palette by position. For lists with no editorial tone of their own
 * (FAQ rows, pricing bullets) — gives rhythm without inventing a hierarchy the
 * content doesn't have.
 */
export function toneByIndex(index: number): PastelTone {
  return TONES[index % TONES.length];
}
