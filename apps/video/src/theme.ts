/**
 * Design tokens, lifted verbatim from the site so a frame of video and a
 * screenshot of the dashboard are the same product (see DESIGN.md, "Look").
 *
 * Sources:
 *   - `COLORS`, `PICKS_COLOR`, `ACCENTS` — `apps/web/src/styles/globals.css`,
 *     the `.dark` block (converted from `r g b` triples back to hex).
 *   - `BENCHMARK_STYLES`, `CHART_CHROME` — `apps/web/src/components/ui/
 *     picks-benchmark-chart.tsx`, the `dark` entries of the same-named maps.
 *   - `FONTS` — `apps/web/src/app/layout.tsx` (Outfit + IBM Plex Mono, the
 *     only two faces the site uses).
 *
 * These are a snapshot, not a live import — the video project is standalone
 * and never depends on `apps/web`. If the site's dark palette or chart
 * styling changes, re-sync this file by hand against the files above.
 */

export const COLORS = {
  bg: "#0A0A0A",
  bgSecondary: "#141414",
  bgTertiary: "#1E1E1E",
  border: "#262626",
  borderLight: "#333333",
  borderStrong: "#525252",
  text: "#FAFAFA",
  textMuted: "#A3A3A3",
  textDim: "#808080",
  green: "#22C55E",
  red: "#EF4444",
  mint: "#A8D9A0",
  cyan: "#7EC8D8",
  lilac: "#C4B0E0",
  peach: "#F0A86C",
  yellow: "#F5D76E",
  coral: "#F07167",
  purple: "#A78BFA",
} as const;

/**
 * Per-benchmark line colour and dash pattern, dash-first — the deck is
 * rendered at a fixed size with no hover state to lean on, so the same rule
 * the site follows (dash is the primary distinguisher, colour only
 * reinforces it) matters even more here than on the dashboard.
 */
export const BENCHMARK_STYLES: Record<string, { color: string; dash: string }> = {
  SPY: { color: "#6EACBA", dash: "7 4" },
  QQQ: { color: "#8B9AD4", dash: "4 3 1 3" },
  VTI: { color: "#827499", dash: "1 5" },
  MAGS: { color: "#775133", dash: "11 4 2 4" },
};

/** Grid, axis, reference-line and cursor colours for the Recharts chart slides. */
export const CHART_CHROME = {
  grid: "#262626",
  tick: "#737373",
  referenceLine: "#333333",
  cursor: "#333333",
} as const;

/** The picks line's colour on every chart slide — always green, never an accent. */
export const PICKS_COLOR = "#22C55E";

/** One pastel per chapter, matching the `.section-label` eyebrow rule's accent classes. */
export const ACCENTS: Record<import("./types").AccentName, string> = {
  mint: COLORS.mint,
  cyan: COLORS.cyan,
  lilac: COLORS.lilac,
  peach: COLORS.peach,
  yellow: COLORS.yellow,
};

export const FONTS = {
  sans: "Outfit",
  mono: "'IBM Plex Mono'",
} as const;

export const VIDEO = {
  width: 1920,
  height: 1080,
  fps: 30,
} as const;

/**
 * Motion is slide-deck, not music-video (DESIGN.md, "Look"): every scene
 * gets a short spring-in before the narration starts and a short hold after
 * it ends, rather than cutting the instant the audio file does.
 */
export const LEAD_IN_SEC = 0.55;
export const TAIL_SEC = 0.9;
