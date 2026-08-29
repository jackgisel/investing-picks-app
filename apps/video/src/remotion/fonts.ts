/**
 * Loads the two faces the deck is allowed to use — Outfit for words, IBM
 * Plex Mono for numbers and tickers (DESIGN.md, "Look": "Two faces, no
 * more"). `@remotion/google-fonts`'s `loadFont` registers the `@font-face`
 * rules and blocks the render (via `delayRender`/`continueRender`
 * internally) until the files are fetched, so importing this module once —
 * from `Deck.tsx`, which every composition renders through — is enough to
 * guarantee both faces are ready before any slide paints.
 */

import { loadFont as loadOutfit } from "@remotion/google-fonts/Outfit";
import { loadFont as loadMono } from "@remotion/google-fonts/IBMPlexMono";

const outfit = loadOutfit("normal", {
  weights: ["400", "500", "600", "700", "800"],
  subsets: ["latin"],
});

const mono = loadMono("normal", {
  weights: ["400", "500", "600", "700"],
  subsets: ["latin"],
});

export const FONT_FAMILY_SANS = outfit.fontFamily;
export const FONT_FAMILY_MONO = mono.fontFamily;
