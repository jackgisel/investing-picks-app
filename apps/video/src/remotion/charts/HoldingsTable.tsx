/**
 * The open book — DESIGN.md's `Holdings` slide. Rows stagger in with a small
 * P&L bar, mirroring `apps/web/src/components/dashboard/positions-open.tsx`
 * (ticker, sector, entry date, return, signal) at video scale.
 *
 * `redacted: true` is load-bearing (see `HoldingFact` in `src/types.ts`):
 * `pack` has already stripped the ticker, name, quant rating, signal and
 * exact P&L for that row before this file is ever read, and left only
 * `sector` and a week/month-granularity `entryDate`. Rendering it as
 * anything but "New position · held back" — even accidentally falling
 * through to the normal row's ticker/name cells, which would print
 * `null`/`—` rather than a redacted ticker but would still LOOK like a
 * present-but-empty row instead of a deliberately withheld one — is a
 * product bug, not a style nit.
 */

import { COLORS } from "../../theme";
import type { HoldingFact } from "../../types";
import { formatCoarseMonth, formatPct, formatShortDate } from "../format";
import { STAGGER_FRAMES, useEnter } from "../motion";

const SIGNAL_COLOR: Record<string, string> = {
  strong_buy: COLORS.green,
  buy: COLORS.green,
  hold: COLORS.lilac,
  sell: COLORS.red,
  strong_sell: COLORS.red,
};

function PnlBar({ value, maxAbs, progress }: { value: number | null; maxAbs: number; progress: number }) {
  const v = value ?? 0;
  const w = maxAbs === 0 ? 0 : (Math.abs(v) / maxAbs) * 64 * progress;
  const color = v > 0 ? COLORS.green : v < 0 ? COLORS.red : COLORS.textDim;
  return (
    <div style={{ position: "relative", width: 68, height: 10 }}>
      <div style={{ position: "absolute", left: v >= 0 ? 0 : 68 - w, width: w, height: 10, borderRadius: 4, background: color }} />
    </div>
  );
}

function Row({
  holding,
  index,
  maxAbsPnl,
  rowHeight,
}: {
  holding: HoldingFact;
  index: number;
  maxAbsPnl: number;
  rowHeight: number;
}) {
  const enter = useEnter(index * STAGGER_FRAMES * 3);
  const style: React.CSSProperties = {
    opacity: enter.opacity,
    transform: enter.transform,
    display: "flex",
    alignItems: "center",
    height: rowHeight,
    borderBottom: `1px solid ${COLORS.border}`,
    gap: 20,
  };

  if (holding.redacted) {
    return (
      <div style={style}>
        <span
          style={{
            fontFamily: "Outfit",
            fontSize: 20,
            fontStyle: "normal",
            color: COLORS.textDim,
            flex: 1,
          }}
        >
          New position · held back
        </span>
        <span style={{ fontFamily: "Outfit", fontSize: 17, color: COLORS.textDim, width: 220 }}>
          {holding.sector ?? "—"}
        </span>
        <span style={{ fontFamily: "'IBM Plex Mono'", fontSize: 16, color: COLORS.textDim, width: 180 }}>
          {formatCoarseMonth(holding.entryDate)}
        </span>
        <span style={{ width: 90 }} />
        <span style={{ width: 130 }} />
      </div>
    );
  }

  const signalColor = holding.signal ? (SIGNAL_COLOR[holding.signal] ?? COLORS.textMuted) : COLORS.textDim;

  return (
    <div style={style}>
      <span style={{ fontFamily: "'IBM Plex Mono'", fontSize: 22, fontWeight: 700, color: COLORS.text, width: 110 }}>
        {holding.ticker ?? "—"}
      </span>
      <span
        style={{
          fontFamily: "Outfit",
          fontSize: 18,
          color: COLORS.textMuted,
          flex: 1,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {holding.name ?? "—"}
      </span>
      <span style={{ fontFamily: "Outfit", fontSize: 17, color: COLORS.textDim, width: 220 }}>
        {holding.sector ?? "—"}
      </span>
      <span style={{ fontFamily: "'IBM Plex Mono'", fontSize: 16, color: COLORS.textDim, width: 130 }}>
        {formatShortDate(holding.entryDate)}
      </span>
      <PnlBar value={holding.pnlPct} maxAbs={maxAbsPnl} progress={enter.opacity} />
      <span
        style={{
          fontFamily: "'IBM Plex Mono'",
          fontSize: 20,
          fontWeight: 700,
          width: 110,
          textAlign: "right",
          color: (holding.pnlPct ?? 0) >= 0 ? COLORS.green : COLORS.red,
        }}
      >
        {formatPct(holding.pnlPct)}
      </span>
      <span
        style={{
          fontFamily: "Outfit",
          fontSize: 13,
          fontWeight: 700,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: signalColor,
          width: 90,
          textAlign: "right",
        }}
      >
        {holding.signal ? holding.signal.replace("_", " ") : ""}
      </span>
    </div>
  );
}

export function HoldingsTable({
  holdings,
  width,
  height,
}: {
  holdings: HoldingFact[];
  width: number;
  height: number;
}) {
  const maxAbsPnl = Math.max(1, ...holdings.map((h) => Math.abs(h.pnlPct ?? 0)));
  const rowHeight = Math.max(46, Math.min(76, height / holdings.length));

  return (
    <div style={{ width, height, display: "flex", flexDirection: "column" }}>
      {holdings.map((h, i) => (
        <Row key={h.ticker ?? `redacted-${i}`} holding={h} index={i} maxAbsPnl={maxAbsPnl} rowHeight={rowHeight} />
      ))}
    </div>
  );
}
