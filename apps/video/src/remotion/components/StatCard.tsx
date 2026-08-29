/**
 * The number tile from `apps/web/src/components/dashboard/stat-tile.tsx`:
 * a dim uppercase label, a big bold mono value coloured by tone, an
 * optional caption underneath.
 */

import { COLORS } from "../../theme";
import { useEnter } from "../motion";

const TONE_COLOR: Record<"up" | "down" | "neutral", string> = {
  up: COLORS.green,
  down: COLORS.red,
  neutral: COLORS.text,
};

export function StatCard({
  label,
  value,
  sub,
  tone = "neutral",
  delayFrames = 0,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "up" | "down" | "neutral";
  delayFrames?: number;
}) {
  const enter = useEnter(delayFrames);
  return (
    <div
      style={{
        opacity: enter.opacity,
        transform: enter.transform,
        background: COLORS.bgSecondary,
        border: `1px solid ${COLORS.border}`,
        borderRadius: 20,
        padding: "28px 32px",
        display: "flex",
        flexDirection: "column",
        gap: 10,
        flex: 1,
        minWidth: 0,
      }}
    >
      <span
        style={{
          fontFamily: "Outfit",
          fontSize: 15,
          fontWeight: 700,
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          color: COLORS.textDim,
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontFamily: "'IBM Plex Mono'",
          fontSize: 52,
          fontWeight: 700,
          color: TONE_COLOR[tone],
          lineHeight: 1.05,
        }}
      >
        {value}
      </span>
      {sub && (
        <span style={{ fontFamily: "Outfit", fontSize: 16, color: COLORS.textDim }}>{sub}</span>
      )}
    </div>
  );
}
