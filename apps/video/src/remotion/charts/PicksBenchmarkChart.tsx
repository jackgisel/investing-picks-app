/**
 * The site's picks-vs-benchmark chart (`apps/web/src/components/ui/
 * picks-benchmark-chart.tsx`), reproduced with the same Recharts primitives,
 * the same tokens and the same dash patterns — see DESIGN.md, "Charts".
 *
 * Two differences from the site version, both required by rendering into a
 * fixed video frame rather than a resizable page:
 *   - Fixed `width`/`height` instead of `ResponsiveContainer` — there is
 *     nothing to measure against when Remotion rasterizes a single frame.
 *   - The Y domain is computed once from the FULL row set, not from the
 *     currently-visible slice, so the axis holds still while the line draws
 *     in. Recomputing "dataMin/dataMax" per frame (the site's behavior,
 *     fine there because the data set never grows under the reader's eyes)
 *     would make the axis rescale every frame here, which reads as the
 *     chart wobbling rather than drawing.
 */

import { useMemo } from "react";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  XAxis,
  YAxis,
} from "recharts";
import type { ChartFact, ChartRow } from "../../types";
import { BENCHMARK_STYLES, CHART_CHROME, COLORS, FONTS, PICKS_COLOR } from "../../theme";

// Used only for a benchmark ticker the deck has no styling for yet — the
// fixture's four (SPY/QQQ/VTI/MAGS) all resolve via BENCHMARK_STYLES, same
// as the site. `textDim` keeps it a "quiet grey" in the same spirit as the
// site's own dark-mode FALLBACK_STYLES without hardcoding a new hex here.
const FALLBACK_STYLE = { color: COLORS.textDim, dash: "4 4" };

function styleFor(key: string): { color: string; dash: string } {
  return BENCHMARK_STYLES[key] ?? FALLBACK_STYLE;
}

function formatPctTick(value: number): string {
  const sign = value >= 0 ? "+" : "";
  return `${sign}${value.toFixed(0)}%`;
}

/** "2026-04-10" -> "Apr 10", parsed as UTC so the label never slips a day. */
function formatShortDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

function numericValues(rows: ChartRow[], key: string): number[] {
  return rows
    .map((r) => r[key])
    .filter((v): v is number => typeof v === "number" && Number.isFinite(v));
}

/**
 * Heckbert's "nice numbers" step — the classic axis-labelling algorithm
 * (round a raw span to 1/2/5 x 10^n) that every charting library uses under
 * the hood to pick tick spacing a human would choose by hand.
 */
function niceStep(rawStep: number): number {
  const exponent = Math.floor(Math.log10(rawStep));
  const fraction = rawStep / 10 ** exponent;
  let niceFraction: number;
  if (fraction <= 1) niceFraction = 1;
  else if (fraction <= 2) niceFraction = 2;
  else if (fraction <= 5) niceFraction = 5;
  else niceFraction = 10;
  return niceFraction * 10 ** exponent;
}

/**
 * A rounded, evenly-spaced axis domain and its tick values for [min, max] —
 * e.g. -7.38..48.18 becomes -20..60 in steps of 20, rather than the raw
 * padded min/max Recharts would otherwise label with uneven, unrounded
 * ticks (+53/+48/+28/+8/-12).
 */
function niceDomain(min: number, max: number, targetTicks = 5): { domain: [number, number]; ticks: number[] } {
  const lo = min === max ? min - 1 : min;
  const hi = min === max ? max + 1 : max;
  const step = niceStep((hi - lo) / Math.max(1, targetTicks - 1));
  const niceMin = Math.floor(lo / step) * step;
  const niceMax = Math.ceil(hi / step) * step;
  const ticks: number[] = [];
  for (let t = niceMin; t <= niceMax + step / 2; t += step) {
    ticks.push(Math.round(t * 100) / 100);
  }
  return { domain: [niceMin, niceMax], ticks };
}

export function PicksBenchmarkChart({
  chart,
  progress,
  width,
  height,
}: {
  chart: ChartFact;
  /** 0 at the first frame of the reveal, 1 once the full series is drawn. */
  progress: number;
  width: number;
  height: number;
}) {
  const rows = chart.rows;
  const visibleCount = Math.max(2, Math.min(rows.length, Math.ceil(progress * rows.length)));
  const visible = useMemo(() => rows.slice(0, visibleCount), [rows, visibleCount]);

  // Fixed once from the full series so the axis never rescales mid-draw, and
  // rounded to a "nice", evenly-spaced domain rather than the raw padded
  // min/max — see `niceDomain` above.
  const { domain: yDomain, ticks: yTicks } = useMemo(() => {
    const keys = ["picks", ...chart.benchmarks.map((b) => b.key)];
    const all = keys.flatMap((k) => numericValues(rows, k));
    if (all.length === 0) return niceDomain(-1, 1);
    return niceDomain(Math.min(...all), Math.max(...all));
  }, [rows, chart.benchmarks]);

  return (
    <div style={{ position: "relative", width, height }}>
      <ComposedChart width={width} height={height} data={visible} margin={{ top: 6, right: 40, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id="picksGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={PICKS_COLOR} stopOpacity={0.16} />
            <stop offset="100%" stopColor={PICKS_COLOR} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke={CHART_CHROME.grid} vertical={false} />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 14, fill: CHART_CHROME.tick, fontFamily: FONTS.mono }}
          tickFormatter={(d: string) => formatShortDate(d)}
          stroke={CHART_CHROME.grid}
          minTickGap={40}
          interval="preserveStartEnd"
        />
        <YAxis
          tick={{ fontSize: 14, fill: CHART_CHROME.tick, fontFamily: FONTS.mono }}
          tickFormatter={formatPctTick}
          stroke={CHART_CHROME.grid}
          width={56}
          domain={yDomain}
          ticks={yTicks}
        />
        <ReferenceLine y={0} stroke={CHART_CHROME.referenceLine} strokeWidth={1} />
        {chart.benchmarks.map((b) => {
          const style = styleFor(b.key);
          return (
            <Line
              key={b.key}
              type="monotone"
              dataKey={b.key}
              stroke={style.color}
              strokeWidth={2}
              strokeDasharray={style.dash}
              strokeLinecap={style.dash === "1 5" ? "round" : "butt"}
              dot={false}
              isAnimationActive={false}
              connectNulls
            />
          );
        })}
        <Area
          type="monotone"
          dataKey="picks"
          stroke={PICKS_COLOR}
          strokeWidth={4}
          fill="url(#picksGrad)"
          dot={false}
          isAnimationActive={false}
          connectNulls
        />
      </ComposedChart>
    </div>
  );
}
