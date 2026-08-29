/**
 * Day / week / month, book against SPY, bars growing from a centred zero
 * line — DESIGN.md's `PeriodBars` slide. Values come from `pack.facts.periods`
 * (see `apps/web/src/components/dashboard/period-performance.tsx` for the
 * site's read of the same numbers, there as tiles + a table rather than
 * bars).
 */

import { CHART_CHROME, COLORS } from "../../theme";
import type { PeriodFact } from "../../types";
import { formatPct, periodCaption } from "../format";

const ROW_LABEL: Record<PeriodFact["id"], string> = { day: "Today", week: "Week to date", month: "Month to date" };

const LABEL_COL_WIDTH = 96;
const VALUE_COL_WIDTH = 130;
const ROW_GAP = 18;
const BAR_HEIGHT = 26;

function Bar({
  value,
  progress,
  maxAbs,
  trackWidth,
}: {
  value: number | null;
  progress: number;
  maxAbs: number;
  trackWidth: number;
}) {
  const half = trackWidth / 2;
  const v = value ?? 0;
  const targetLen = maxAbs === 0 ? 0 : (Math.abs(v) / maxAbs) * (half - 12);
  const len = targetLen * progress;
  const color = v > 0 ? COLORS.green : v < 0 ? COLORS.red : COLORS.textDim;
  return (
    <div style={{ position: "relative", width: trackWidth, height: BAR_HEIGHT }}>
      <div
        style={{
          position: "absolute",
          top: 0,
          height: BAR_HEIGHT,
          borderRadius: 6,
          background: color,
          ...(v >= 0 ? { left: half, width: len } : { right: half, width: len }),
        }}
      />
    </div>
  );
}

function PeriodGroup({
  period,
  progress,
  maxAbs,
  trackWidth,
}: {
  period: PeriodFact;
  progress: number;
  maxAbs: number;
  trackWidth: number;
}) {
  // The zero rule spans both rows of this period, behind the bars, so a
  // viewer can see where zero is and read a bar's sign without reading the
  // number (DESIGN.md's centred-zero-line framing, made visible rather than
  // implied).
  const zeroX = LABEL_COL_WIDTH + ROW_GAP + trackWidth / 2;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <span style={{ fontFamily: "Outfit", fontSize: 22, fontWeight: 600, color: COLORS.textMuted }}>
          {ROW_LABEL[period.id] ?? period.label}
        </span>
        <span style={{ fontFamily: "Outfit", fontSize: 15, color: COLORS.textDim }}>
          {periodCaption(period.fromDate)}
        </span>
      </div>
      <div style={{ position: "relative", display: "flex", flexDirection: "column", gap: 16 }}>
        <div
          style={{
            position: "absolute",
            left: zeroX - 1,
            top: 0,
            bottom: 0,
            width: 2,
            background: CHART_CHROME.referenceLine,
          }}
        />
        <div style={{ display: "flex", alignItems: "center", gap: ROW_GAP }}>
          <span
            style={{
              fontFamily: "Outfit",
              fontSize: 15,
              width: LABEL_COL_WIDTH,
              color: COLORS.textDim,
              textTransform: "uppercase",
              letterSpacing: "0.06em",
            }}
          >
            Book
          </span>
          <Bar value={period.bookReturnPct} progress={progress} maxAbs={maxAbs} trackWidth={trackWidth} />
          <span
            style={{
              fontFamily: "'IBM Plex Mono'",
              fontSize: 20,
              fontWeight: 700,
              width: VALUE_COL_WIDTH,
              textAlign: "right",
              color: (period.bookReturnPct ?? 0) >= 0 ? COLORS.green : COLORS.red,
            }}
          >
            {formatPct(period.bookReturnPct)}
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: ROW_GAP }}>
          <span
            style={{
              fontFamily: "Outfit",
              fontSize: 15,
              width: LABEL_COL_WIDTH,
              color: COLORS.textDim,
              textTransform: "uppercase",
              letterSpacing: "0.06em",
            }}
          >
            S&amp;P 500
          </span>
          <Bar value={period.spyReturnPct} progress={progress} maxAbs={maxAbs} trackWidth={trackWidth} />
          <span
            style={{
              fontFamily: "'IBM Plex Mono'",
              fontSize: 20,
              fontWeight: 700,
              width: VALUE_COL_WIDTH,
              textAlign: "right",
              color: (period.spyReturnPct ?? 0) >= 0 ? COLORS.green : COLORS.red,
            }}
          >
            {formatPct(period.spyReturnPct)}
          </span>
        </div>
      </div>
    </div>
  );
}

export function PeriodBars({
  periods,
  progress,
  width,
}: {
  periods: PeriodFact[];
  /** 0..1 draw progress, shared by every bar so they grow together. */
  progress: number;
  width: number;
}) {
  const maxAbs = Math.max(
    1,
    ...periods.flatMap((p) => [Math.abs(p.bookReturnPct ?? 0), Math.abs(p.spyReturnPct ?? 0)]),
  );
  const trackWidth = width - LABEL_COL_WIDTH - VALUE_COL_WIDTH - ROW_GAP * 2;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 56, width }}>
      {periods.map((p) => (
        <PeriodGroup key={p.id} period={p} progress={progress} maxAbs={maxAbs} trackWidth={trackWidth} />
      ))}
    </div>
  );
}
