/**
 * The `.section-label` eyebrow rule from `apps/web/src/styles/globals.css`:
 * an 11px uppercase, bold, `0.18em`-tracked label preceded by a short
 * rounded bar in the chapter's accent colour. Every slide gets one
 * (DESIGN.md, "Look").
 */

import { ACCENTS, COLORS } from "../../theme";
import type { AccentName } from "../../types";

export function Eyebrow({ label, accent }: { label: string; accent: AccentName }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <span
        style={{
          display: "block",
          width: 20,
          height: 4,
          borderRadius: 999,
          background: ACCENTS[accent],
          flexShrink: 0,
        }}
      />
      <span
        style={{
          fontFamily: "Outfit",
          fontSize: 15,
          fontWeight: 700,
          letterSpacing: "0.18em",
          textTransform: "uppercase",
          color: COLORS.text,
        }}
      >
        {label}
      </span>
    </div>
  );
}
