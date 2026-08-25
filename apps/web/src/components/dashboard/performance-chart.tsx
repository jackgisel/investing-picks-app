"use client";

import { useMemo, useState } from "react";
import {
  buildPicksComparison,
  useChart,
  type ChartWindow,
  type WindowOption,
} from "@/lib/hooks/use-chart";
import { DataState, resolveDataState } from "@/components/ui/data-state";
import { Skeleton } from "@/components/ui/skeleton";
import {
  BenchmarkBasisNote,
  PicksBenchmarkChart,
  PicksBenchmarkLegend,
  formatChartPct,
  formatChartDate,
} from "@/components/ui/picks-benchmark-chart";
import { TrendingUp } from "lucide-react";
import { pnlClass } from "@/lib/portfolio";

/**
 * Ranges, widest first — the same order a brokerage puts them in, and the
 * order that puts the default at the left edge.
 *
 * These are fallbacks. The API publishes the same list with an `available`
 * flag per range, and that is what actually drives the control; this only
 * covers the first paint, before any response has landed.
 */
const FALLBACK_WINDOWS: readonly WindowOption[] = [
  { id: "inception", label: "Since inception", available: true },
  { id: "1y", label: "1 year", available: false },
  { id: "6m", label: "6 months", available: false },
  { id: "1m", label: "1 month", available: false },
  { id: "1w", label: "1 week", available: false },
];

const WINDOW_ORDER: readonly ChartWindow[] = [
  "inception",
  "1y",
  "6m",
  "1m",
  "1w",
];

/** Short chip labels. The API's are written for a sentence, not a control. */
const SHORT_LABEL: Record<ChartWindow, string> = {
  inception: "All",
  "1y": "1Y",
  "6m": "6M",
  "1m": "1M",
  "1w": "1W",
};

/** What the headline number measures, per range. */
const WINDOW_BLURB: Record<ChartWindow, string> = {
  inception:
    "Cumulative return since the first pick — idle cash excluded, closed picks included.",
  "1y": "Return over the last year, with every pick held a year ago re-entered at its value then.",
  "6m": "Return over the last six months, with every pick held six months ago re-entered at its value then.",
  "1m": "Return over the last month, with every pick held a month ago re-entered at its value then.",
  "1w": "Return over the last week, with every pick held a week ago re-entered at its value then.",
};

function orderWindows(options: readonly WindowOption[]): WindowOption[] {
  const byId = new Map(options.map((o) => [o.id, o]));
  return WINDOW_ORDER.flatMap((id) => {
    const option = byId.get(id);
    return option ? [option] : [];
  });
}

/**
 * The range control.
 *
 * A range the book is too young for is rendered DISABLED rather than hidden.
 * Hiding it makes the control look like it only ever had three options;
 * disabling it says "not yet", which is the true statement — and the title
 * explains why, since a greyed-out button with no reason is just broken.
 */
function RangePicker({
  options,
  value,
  onChange,
}: {
  options: readonly WindowOption[];
  value: ChartWindow;
  onChange: (next: ChartWindow) => void;
}) {
  return (
    <div
      className="flex flex-wrap items-center gap-1.5"
      role="group"
      aria-label="Chart range"
    >
      {orderWindows(options).map((option) => {
        const selected = option.id === value;
        return (
          <button
            key={option.id}
            type="button"
            disabled={!option.available}
            aria-pressed={selected}
            title={
              option.available
                ? option.label
                : `${option.label} — the book is not that old yet`
            }
            onClick={() => onChange(option.id)}
            className={`rounded-pill px-3 py-1 font-sans text-[10px] font-bold uppercase tracking-[0.1em] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text focus-visible:ring-offset-2 focus-visible:ring-offset-bg ${
              selected
                ? "bg-inverse text-inverse-fg"
                : option.available
                  ? "border border-border bg-bg text-text-dim hover:text-text"
                  : "border border-border/50 bg-bg text-text-dim/40 cursor-not-allowed"
            }`}
          >
            {SHORT_LABEL[option.id] ?? option.label}
          </button>
        );
      })}
    </div>
  );
}

function EmptyChart({
  compact,
  windowed,
}: {
  compact?: boolean;
  windowed: boolean;
}) {
  return (
    <div
      className={`${compact ? "h-56" : "h-80"} flex flex-col items-center justify-center`}
    >
      <TrendingUp size={28} className="text-text-dim mb-3" />
      <span className="field-label">
        {windowed ? "Not enough of this range" : "Building track record"}
      </span>
      <p className="font-sans text-[13px] text-text-muted mt-2 max-w-sm text-center">
        {windowed
          ? "There are fewer than two days of marks inside this range. Try a wider one."
          : "The picks curve populates once there are at least two days of marks on the capital deployed into picks."}
      </p>
    </div>
  );
}

export function PerformanceChart({ compact = false }: { compact?: boolean }) {
  // Ranges live on the full chart only. The compact copy exists to keep the
  // dashboard home light, and a control the reader has to think about is the
  // opposite of that — the full surface is one click away.
  const [window, setWindow] = useState<ChartWindow>("inception");
  const active = compact ? "inception" : window;

  const { data: chartData, isPending, isError, error, refetch } = useChart(active);
  const comparison = useMemo(
    () => buildPicksComparison(chartData),
    [chartData]
  );

  const options = chartData?.summary?.window_options ?? FALLBACK_WINDOWS;
  const { benchmarks, picksLatestPct, startDate, latestDate } = comparison;

  // Two points is the minimum that draws a line. Note this counts the PICKS
  // curve, not the legacy book-equity series — an API that only returns the old
  // shape gets the empty state rather than a book-equity line mislabelled as
  // picks.
  const picksPoints = comparison.rows.filter((r) => r.picks !== null).length;

  // A failed fetch must not fall through to "Building track record", which
  // claims the series is merely short when in fact we never got one.
  const errorState = isError
    ? resolveDataState({ isPending: false, isError: true, error, isEmpty: false })!
    : null;

  // The frame — header, headline and range control — renders in every state.
  // Swapping the whole card for a skeleton made the range buttons vanish the
  // instant they were clicked, which reads as the control breaking rather than
  // as the chart loading.
  let body: React.ReactNode;
  if (isPending) {
    body = (
      <div
        className={`${compact ? "h-56" : "h-80"} flex flex-col justify-end gap-3`}
        role="status"
        aria-label="Loading chart"
      >
        <Skeleton className="h-3 w-40" />
        <Skeleton className="h-full w-full" />
      </div>
    );
  } else if (errorState) {
    body = (
      <div
        className={`${compact ? "h-56" : "h-80"} flex items-center justify-center`}
      >
        <DataState state={errorState} error={error} onRetry={() => void refetch()} />
      </div>
    );
  } else if (picksPoints < 2) {
    body = <EmptyChart compact={compact} windowed={active !== "inception"} />;
  } else {
    body = (
      <>
        <div className={compact ? "mb-3" : "mb-4"}>
          <PicksBenchmarkLegend comparison={comparison} compact={compact} />
        </div>

        <PicksBenchmarkChart
          comparison={comparison}
          height={compact ? 220 : 340}
          compact={compact}
        />

        {benchmarks.length > 0 && (
          <div className={compact ? "mt-3" : "mt-5"}>
            {!compact && picksLatestPct !== null && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
                {benchmarks.map((b) => {
                  const gap =
                    b.latestPct === null ? null : picksLatestPct - b.latestPct;
                  return (
                    <div
                      key={b.key}
                      className="rounded-soft border border-border px-4 py-3"
                    >
                      <p className="field-label">vs {b.label}</p>
                      <p
                        className={`font-mono text-[18px] font-bold mt-1.5 leading-none ${pnlClass(
                          gap,
                        )}`}
                      >
                        {gap === null
                          ? "—"
                          : `${gap >= 0 ? "+" : ""}${gap.toFixed(2)} pts`}
                      </p>
                      <p className="font-mono text-[10px] text-text-dim mt-1.5">
                        {b.key}{" "}
                        {b.latestPct === null ? "—" : formatChartPct(b.latestPct)}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
            <BenchmarkBasisNote startDate={startDate} />
          </div>
        )}

        {benchmarks.length === 0 && !compact && (
          <p className="font-sans text-[11px] text-text-dim leading-relaxed mt-5">
            Benchmark comparisons are unavailable right now — index price
            history did not load, and we would rather show nothing than a flat
            line.
          </p>
        )}
      </>
    );
  }

  return (
    <div className="data-card">
      <div
        className={`flex flex-wrap items-start justify-between gap-x-6 gap-y-3 ${
          compact ? "mb-3" : "mb-5"
        }`}
      >
        <div>
          <span className="panel-label">
            Return on capital deployed into picks
          </span>
          {!compact && (
            <p className="font-sans text-[13px] text-text-muted mt-1 max-w-lg">
              {WINDOW_BLURB[active]}
            </p>
          )}
        </div>
        {!isPending && !errorState && picksLatestPct !== null && (
          <div className="text-right">
            <span
              className={`font-mono text-[26px] font-bold leading-none ${pnlClass(
                picksLatestPct,
              )}`}
            >
              {formatChartPct(picksLatestPct)}
            </span>
            {latestDate && (
              <p className="font-mono text-[10px] text-text-dim mt-1.5">
                as of {formatChartDate(latestDate)}
              </p>
            )}
          </div>
        )}
      </div>

      {!compact && (
        <div className="mb-4">
          <RangePicker options={options} value={window} onChange={setWindow} />
        </div>
      )}

      {body}
    </div>
  );
}
