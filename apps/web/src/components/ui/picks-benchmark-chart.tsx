"use client";

import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
} from "recharts";
import type { BenchmarkMeta, PicksComparison } from "@/lib/hooks/use-chart";

const PICKS_COLOR = "#16A34A";
const PICKS_LABEL = "Outpick picks";

/**
 * Benchmark line styling.
 *
 * Every benchmark gets its own dash pattern as well as its own grey, because
 * the page prints and because colour-blind readers get no help from three
 * shades of the same hue. The dash is the primary distinguisher; the tone only
 * reinforces it. All of them are deliberately quieter than the picks line —
 * they are context, not competition.
 */
interface LineStyle {
  color: string;
  dash: string;
}

const BENCHMARK_STYLES: Record<string, LineStyle> = {
  SPY: { color: "#525252", dash: "7 4" },
  VTI: { color: "#7C7C7C", dash: "1 5" },
  MAGS: { color: "#9E9E9E", dash: "11 4 2 4" },
};

/** Used for any ticker the API starts returning that we have not styled. */
const FALLBACK_STYLES: LineStyle[] = [
  { color: "#666666", dash: "4 4" },
  { color: "#8A8A8A", dash: "12 5" },
  { color: "#A6A6A6", dash: "2 3" },
];

function styleFor(key: string, index: number): LineStyle {
  return (
    BENCHMARK_STYLES[key] ?? FALLBACK_STYLES[index % FALLBACK_STYLES.length]
  );
}

function formatPctTick(value: number): string {
  const sign = value >= 0 ? "+" : "";
  return `${sign}${value.toFixed(0)}%`;
}

function formatPctValue(value: number, digits = 2): string {
  const sign = value >= 0 ? "+" : "";
  return `${sign}${value.toFixed(digits)}%`;
}

/** "2026-04-10" → "Apr 10". Parsed as UTC so the label never slips a day. */
function formatShortDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

/** "2026-04-10" → "Apr 10, 2026". */
function formatLongDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** A legend/tooltip swatch that carries the line's actual dash pattern. */
function LineSwatch({
  color,
  dash,
  width = 22,
  strokeWidth = 2,
}: {
  color: string;
  dash?: string;
  width?: number;
  strokeWidth?: number;
}) {
  return (
    <svg
      width={width}
      height={strokeWidth + 4}
      viewBox={`0 0 ${width} ${strokeWidth + 4}`}
      className="shrink-0 overflow-visible"
      aria-hidden
    >
      <line
        x1="0"
        y1={(strokeWidth + 4) / 2}
        x2={width}
        y2={(strokeWidth + 4) / 2}
        stroke={color}
        strokeWidth={strokeWidth}
        strokeDasharray={dash}
        strokeLinecap={dash === "1 5" ? "round" : "butt"}
      />
    </svg>
  );
}

interface TooltipEntry {
  dataKey?: unknown;
  value?: unknown;
}

interface TooltipShape {
  active?: boolean;
  label?: unknown;
  payload?: TooltipEntry[];
}

function ChartTooltip({
  raw,
  benchmarks,
}: {
  raw: unknown;
  benchmarks: BenchmarkMeta[];
}) {
  const props = (raw ?? {}) as TooltipShape;
  if (!props.active || !props.payload?.length) return null;

  const byKey = new Map<string, number>();
  props.payload.forEach((entry) => {
    const key = typeof entry.dataKey === "string" ? entry.dataKey : null;
    const value = typeof entry.value === "number" ? entry.value : null;
    if (key && value !== null && Number.isFinite(value)) byKey.set(key, value);
  });

  const picksValue = byKey.get("picks");
  const rows: { label: string; value: number; style: LineStyle; hero: boolean }[] =
    [];
  if (typeof picksValue === "number") {
    rows.push({
      label: PICKS_LABEL,
      value: picksValue,
      style: { color: PICKS_COLOR, dash: "" },
      hero: true,
    });
  }
  benchmarks.forEach((b, i) => {
    const value = byKey.get(b.key);
    if (typeof value === "number") {
      rows.push({ label: b.label, value, style: styleFor(b.key, i), hero: false });
    }
  });

  if (!rows.length) return null;

  return (
    <div className="rounded-soft border border-border bg-bg px-3.5 py-3 shadow-[0_8px_24px_rgba(0,0,0,0.08)]">
      <p className="font-mono text-[10px] text-text-dim mb-2">
        {typeof props.label === "string" ? formatLongDate(props.label) : ""}
      </p>
      <div className="space-y-1.5">
        {rows.map((row) => (
          <div
            key={row.label}
            className="flex items-center justify-between gap-5"
          >
            <span className="flex items-center gap-2">
              <LineSwatch
                color={row.style.color}
                dash={row.style.dash || undefined}
                strokeWidth={row.hero ? 3 : 2}
              />
              <span
                className={`font-sans text-[11px] ${
                  row.hero ? "text-text font-semibold" : "text-text-muted"
                }`}
              >
                {row.label}
              </span>
            </span>
            <span
              className={`font-mono text-[11px] font-bold ${
                row.hero
                  ? row.value >= 0
                    ? "text-accent-green"
                    : "text-accent-red"
                  : "text-text-muted"
              }`}
            >
              {formatPctValue(row.value)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Legend entries, with each series' latest value when there is room for it. */
export function PicksBenchmarkLegend({
  comparison,
  showValues = true,
  compact = false,
}: {
  comparison: PicksComparison;
  showValues?: boolean;
  compact?: boolean;
}) {
  const { benchmarks, picksLatestPct } = comparison;
  return (
    <ul
      className={`flex flex-wrap items-center ${compact ? "gap-x-4 gap-y-2" : "gap-x-5 gap-y-2"}`}
    >
      <li className="flex items-center gap-2">
        <LineSwatch color={PICKS_COLOR} strokeWidth={3} />
        <span className="font-sans text-[11px] font-bold text-text">
          {PICKS_LABEL}
        </span>
        {showValues && picksLatestPct !== null && (
          <span
            className={`font-mono text-[11px] font-bold ${
              picksLatestPct >= 0 ? "text-accent-green" : "text-accent-red"
            }`}
          >
            {formatPctValue(picksLatestPct)}
          </span>
        )}
      </li>
      {benchmarks.map((b, i) => {
        const style = styleFor(b.key, i);
        return (
          <li key={b.key} className="flex items-center gap-2">
            <LineSwatch
              color={style.color}
              dash={style.dash}
              strokeWidth={1.75}
            />
            <span className="font-sans text-[11px] text-text-muted">
              {b.label}
            </span>
            {showValues && b.latestPct !== null && (
              <span className="font-mono text-[11px] text-text-dim">
                {formatPctValue(b.latestPct)}
              </span>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/**
 * The picks curve against benchmarks bought with the same dollars on the same
 * dates.
 *
 * Presentational only — loading, error and empty states belong to the caller,
 * which owns the query. Callers must not render this with fewer than two picks
 * points; there is no line to draw.
 */
export function PicksBenchmarkChart({
  comparison,
  height = 320,
  compact = false,
}: {
  comparison: PicksComparison;
  height?: number;
  compact?: boolean;
}) {
  const { rows, benchmarks, picksLatestPct, startDate } = comparison;

  const summary = [
    `Outpick picks ${picksLatestPct !== null ? formatPctValue(picksLatestPct) : "n/a"}`,
    ...benchmarks.map(
      (b) =>
        `${b.label} ${b.latestPct !== null ? formatPctValue(b.latestPct) : "n/a"}`
    ),
  ].join("; ");

  return (
    <div
      role="img"
      aria-label={`Cumulative return since ${
        startDate ? formatLongDate(startDate) : "inception"
      }. ${summary}.`}
    >
      <ResponsiveContainer width="100%" height={height}>
        <ComposedChart
          data={rows}
          margin={{ top: 6, right: 6, bottom: 0, left: 0 }}
        >
          <defs>
            <linearGradient id="picksGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={PICKS_COLOR} stopOpacity={0.16} />
              <stop offset="100%" stopColor={PICKS_COLOR} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="#E5E5E5"
            vertical={false}
          />
          <XAxis
            dataKey="date"
            tick={{
              fontSize: 10,
              fill: "#737373",
              fontFamily: "IBM Plex Mono",
            }}
            tickFormatter={(d: string) => formatShortDate(d)}
            stroke="#E5E5E5"
            minTickGap={compact ? 40 : 28}
            interval="preserveStartEnd"
          />
          <YAxis
            tick={{
              fontSize: 10,
              fill: "#737373",
              fontFamily: "IBM Plex Mono",
            }}
            tickFormatter={formatPctTick}
            stroke="#E5E5E5"
            width={44}
            domain={["dataMin - 2", "dataMax + 2"]}
          />
          {/* Benchmarks can sit below zero; without this the break-even line is
              invisible and a negative benchmark reads as merely "low". */}
          <ReferenceLine y={0} stroke="#D4D4D4" strokeWidth={1} />
          <Tooltip
            cursor={{ stroke: "#D4D4D4", strokeWidth: 1 }}
            content={(props: unknown) => (
              <ChartTooltip raw={props} benchmarks={benchmarks} />
            )}
          />
          {benchmarks.map((b, i) => {
            const style = styleFor(b.key, i);
            return (
              <Line
                key={b.key}
                type="monotone"
                dataKey={b.key}
                name={b.label}
                stroke={style.color}
                strokeWidth={1.5}
                strokeDasharray={style.dash}
                strokeLinecap={style.dash === "1 5" ? "round" : "butt"}
                dot={false}
                activeDot={{ r: 2.5, strokeWidth: 0 }}
                isAnimationActive={false}
                // A benchmark whose latest mark has not landed simply stops
                // short; an interior hole is bridged rather than shattering the
                // line into fragments.
                connectNulls
              />
            );
          })}
          <Area
            type="monotone"
            dataKey="picks"
            name={PICKS_LABEL}
            stroke={PICKS_COLOR}
            strokeWidth={compact ? 2.5 : 3}
            fill="url(#picksGrad)"
            dot={false}
            activeDot={{ r: 3.5, strokeWidth: 0 }}
            isAnimationActive={false}
            connectNulls
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

/**
 * The one-line honesty note that has to travel with the chart.
 *
 * Without it a reader assumes the benchmark is "the index since inception",
 * which is a different and much weaker claim than the one being made.
 */
export function BenchmarkBasisNote({
  startDate,
  className = "",
}: {
  startDate?: string | null;
  className?: string;
}) {
  return (
    <p className={`font-sans text-[11px] text-text-dim leading-relaxed ${className}`}>
      Like-for-like: each benchmark invests the{" "}
      <span className="text-text-muted">same capital on the same dates</span> as
      the picks, so both sides hold the market for exactly the same time.
      {startDate ? ` Every line starts at 0% on ${formatLongDate(startDate)}.` : ""}
    </p>
  );
}

export { formatPctValue as formatChartPct, formatLongDate as formatChartDate };
