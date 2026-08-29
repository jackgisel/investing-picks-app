/**
 * The shared shell every slide renders inside: `COLORS.bg` ground, generous
 * margins, the chapter eyebrow top-left, and the Outpick mark small in the
 * top-right corner (DESIGN.md, "Look" — "the deck is the website, moving").
 */

import type { ReactNode } from "react";
import { AbsoluteFill } from "remotion";
import { COLORS } from "../../theme";
import type { AccentName } from "../../types";
import { Eyebrow } from "./Eyebrow";
import { OutpickMark } from "./OutpickMark";

export const SLIDE_MARGIN_X = 128;
export const SLIDE_MARGIN_TOP = 88;
export const SLIDE_MARGIN_BOTTOM = 96;

export function SlideFrame({
  chapter,
  accent,
  children,
  contentStyle,
}: {
  chapter: string;
  accent: AccentName;
  children: ReactNode;
  contentStyle?: React.CSSProperties;
}) {
  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.bg, fontFamily: "Outfit", color: COLORS.text }}>
      <div
        style={{
          position: "absolute",
          top: SLIDE_MARGIN_TOP,
          left: SLIDE_MARGIN_X,
          right: SLIDE_MARGIN_X,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <Eyebrow label={chapter} accent={accent} />
        <OutpickMark size={30} />
      </div>
      <div
        style={{
          position: "absolute",
          top: SLIDE_MARGIN_TOP + 64,
          left: SLIDE_MARGIN_X,
          right: SLIDE_MARGIN_X,
          bottom: SLIDE_MARGIN_BOTTOM,
          display: "flex",
          flexDirection: "column",
          ...contentStyle,
        }}
      >
        {children}
      </div>
    </AbsoluteFill>
  );
}
