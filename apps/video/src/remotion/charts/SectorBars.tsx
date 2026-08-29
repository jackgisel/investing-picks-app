/**
 * Sector weights, bars growing left to right — DESIGN.md's `Sectors` slide.
 * Reproduces the ordering and the "N names" language of `apps/web/src/
 * components/dashboard/sector-allocation.tsx`, as bars rather than the
 * site's stacked strip + list (a video frame has no hover state to fall
 * back on for the exact percentage, so the number has to be on the bar).
 */

import { COLORS } from "../../theme";
import { STAGGER_FRAMES, useEnter } from "../motion";

interface SectorRow {
  sector: string;
  count: number;
  sharePct: number;
}

function SectorRowBar({
  row,
  maxShare,
  trackWidth,
  index,
}: {
  row: SectorRow;
  maxShare: number;
  trackWidth: number;
  index: number;
}) {
  const enter = useEnter(index * STAGGER_FRAMES * 3);
  const width = maxShare === 0 ? 0 : (row.sharePct / maxShare) * trackWidth * enter.opacity;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, opacity: enter.opacity }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
        <span style={{ fontFamily: "Outfit", fontSize: 20, color: COLORS.textMuted }}>
          {row.sector}
          <span style={{ fontFamily: "'IBM Plex Mono'", fontSize: 15, color: COLORS.textDim, marginLeft: 10 }}>
            {row.count} {row.count === 1 ? "name" : "names"}
          </span>
        </span>
        <span style={{ fontFamily: "'IBM Plex Mono'", fontSize: 22, fontWeight: 700, color: COLORS.text }}>
          {row.sharePct.toFixed(1)}%
        </span>
      </div>
      <div style={{ width: trackWidth, height: 16, borderRadius: 8, background: COLORS.bgTertiary, overflow: "hidden" }}>
        <div style={{ width, height: "100%", borderRadius: 8, background: COLORS.mint }} />
      </div>
    </div>
  );
}

export function SectorBars({ sectors, width }: { sectors: SectorRow[]; width: number }) {
  const maxShare = Math.max(1, ...sectors.map((s) => s.sharePct));
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 26, width }}>
      {sectors.map((s, i) => (
        <SectorRowBar key={s.sector} row={s} maxShare={maxShare} trackWidth={width} index={i} />
      ))}
    </div>
  );
}
