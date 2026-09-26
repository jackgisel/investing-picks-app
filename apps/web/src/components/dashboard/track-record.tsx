"use client";

import { Fragment, useState } from "react";
import {
  useTrackRecord,
  type MonthReturn,
  type ScorecardPick,
} from "@/lib/hooks/use-track-record";
import { usePeriodReturns } from "@/lib/hooks/use-period-returns";
import {
  DataState,
  DataStateRow,
  hasDataState,
  resolveDataState,
} from "@/components/ui/data-state";
import {
  FilterChips,
  FilteredOutRow,
  PanelHeader,
  SortableHead,
  type Column,
  type SortDir,
} from "@/components/dashboard/data-table";
import { HScroll } from "@/components/ui/h-scroll";
import { CompanyLogo } from "@/components/ui/company-logo";
import {
  comparePnl,
  formatPctOrDash,
  formatWeekdayDate,
  pnlClass,
} from "@/lib/portfolio";
import {
  PERIOD_ORDER,
  PERIOD_TAB_LABEL,
  coverageNote,
  periodCaption,
} from "@/lib/period-returns";
import {
  daysHeld,
  formatMonth,
  monthGrid,
  monthStats,
  scorecardStats,
  type Ratio,
} from "@/lib/track-record";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function pts(v: number | null | undefined, digits = 1): string {
  if (typeof v !== "number" || !Number.isFinite(v)) return "—";
  return `${v > 0 ? "+" : ""}${v.toFixed(digits)} pts`;
}

function ratioPct(r: Ratio): string {
  return r.pct === null ? "—" : `${Math.round(r.pct)}%`;
}

// ---------------------------------------------------------------------------
// Key statistics
// ---------------------------------------------------------------------------

function Stat({
  label,
  value,
  valueClass = "text-text",
  detail,
}: {
  label: string;
  value: React.ReactNode;
  valueClass?: string;
  detail?: React.ReactNode;
}) {
  return (
    <div className="border-b border-r border-border px-5 py-4">
      <dt className="field-label">{label}</dt>
      <dd className={`mt-1.5 font-mono text-[20px] font-bold leading-none tabular-nums ${valueClass}`}>
        {value}
      </dd>
      {detail && (
        <dd className="mt-1.5 font-sans text-[11px] leading-snug text-text-dim">
          {detail}
        </dd>
      )}
    </div>
  );
}

/**
 * The factsheet block: the numbers a published picking record is judged on,
 * in one place. The curve above says where the book ended up; these say how
 * it got there — broadly, or on one or two names.
 */
export function TrackRecordStats() {
  const { data, isPending, isError, error, refetch } = useTrackRecord();
  const picks = scorecardStats(data?.picks ?? []);
  const months = monthStats(data?.months ?? []);
  const state = resolveDataState({
    isPending,
    isError,
    error,
    isEmpty: (data?.picks.length ?? 0) === 0,
  });

  return (
    <div className="data-panel">
      <PanelHeader label="Key statistics" tone="mint">
        <span className="font-mono text-[10px] text-text-dim">
          {data ? `${picks.total} PICKS · ${picks.open} OPEN · ${picks.closed} CLOSED` : "—"}
        </span>
      </PanelHeader>
      {hasDataState(state) ? (
        <DataState
          state={state}
          error={error}
          onRetry={() => void refetch()}
          emptyTitle="No picks yet"
          emptyMessage="Statistics appear once the first pick is made."
          compact
        />
      ) : (
        // Every cell draws its right and bottom rule; the -1px margins push the
        // outer ones under the panel's own border, which clips them.
        <dl className="-mb-px -mr-px grid grid-cols-2 sm:grid-cols-4">
          <Stat
            label="BEAT THE S&P"
            value={ratioPct(picks.beatSpy)}
            valueClass={
              picks.beatSpy.pct === null
                ? "text-text"
                : picks.beatSpy.pct >= 50
                  ? "text-accent-green"
                  : "text-accent-red"
            }
            detail={`${picks.beatSpy.n} of ${picks.beatSpy.of} picks, each over its own holding period`}
          />
          <Stat
            label="MEDIAN PICK"
            value={formatPctOrDash(picks.medianReturnPct, 1)}
            valueClass={pnlClass(picks.medianReturnPct)}
            detail={`${pts(picks.medianExcessPct)} vs the S&P`}
          />
          <Stat
            label="CLOSED WIN RATE"
            value={ratioPct(picks.closedWins)}
            detail={
              picks.closedWins.of > 0
                ? `${picks.closedWins.n} of ${picks.closedWins.of} closed above cost`
                : "Nothing closed yet"
            }
          />
          <Stat
            label="DOUBLED"
            value={picks.doubled}
            detail="Picks at +100% or better"
          />
          <Stat
            label="BEST PICK"
            value={formatPctOrDash(picks.best?.return_pct, 1)}
            valueClass={pnlClass(picks.best?.return_pct)}
            detail={picks.best ? `${picks.best.ticker} · ${picks.best.status === "closed" ? "closed" : "open"}` : undefined}
          />
          <Stat
            label="WORST PICK"
            value={formatPctOrDash(picks.worst?.return_pct, 1)}
            valueClass={pnlClass(picks.worst?.return_pct)}
            detail={picks.worst ? `${picks.worst.ticker} · ${picks.worst.status === "closed" ? "closed" : "open"}` : undefined}
          />
          <Stat
            label="MONTHS AHEAD OF S&P"
            value={months.beatSpy.of > 0 ? `${months.beatSpy.n}/${months.beatSpy.of}` : "—"}
            detail={
              months.positive.of > 0
                ? `${months.positive.n} of ${months.positive.of} months up`
                : undefined
            }
          />
          <Stat
            label="BEST / WORST MONTH"
            value={
              <span>
                <span className={pnlClass(months.best?.picks_pct)}>
                  {formatPctOrDash(months.best?.picks_pct, 1)}
                </span>
                <span className="text-text-dim"> / </span>
                <span className={pnlClass(months.worst?.picks_pct)}>
                  {formatPctOrDash(months.worst?.picks_pct, 1)}
                </span>
              </span>
            }
            detail={
              months.best
                ? `${formatMonth(months.best.month)}${months.worst ? ` · ${formatMonth(months.worst.month)}` : ""}`
                : undefined
            }
          />
        </dl>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Short term
// ---------------------------------------------------------------------------

/**
 * Today / this week / this month as three rows rather than three screens.
 * The old version made you pick a period to see one pair of numbers.
 */
export function RecentPeriods() {
  const { data, isPending, isError, error, refetch } = usePeriodReturns();
  const state = resolveDataState({
    isPending,
    isError,
    error,
    isEmpty: (data?.periods.length ?? 0) === 0,
  });

  return (
    <div className="data-panel flex flex-col">
      <PanelHeader label="Short term" tone="lilac">
        <span className="font-mono text-[10px] text-text-dim">
          {data?.as_of ? `AS OF ${formatWeekdayDate(data.as_of)?.toUpperCase()}` : "—"}
        </span>
      </PanelHeader>
      {hasDataState(state) ? (
        <DataState
          state={state}
          error={error}
          onRetry={() => void refetch()}
          emptyTitle="No marks yet"
          emptyMessage="Short-term returns appear the session after the first pick."
          compact
        />
      ) : (
        <>
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                {["", "PICKS", "S&P 500", "DIFF"].map((h, i) => (
                  <th
                    key={h || "period"}
                    scope="col"
                    className={`px-4 py-2.5 font-sans text-[10px] font-bold tracking-[0.12em] text-text-dim ${i === 0 ? "text-left" : "text-right"}`}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {PERIOD_ORDER.map((id) => {
                const p = data?.periods.find((x) => x.id === id);
                const diff =
                  typeof p?.open_picks_return_pct === "number" &&
                  typeof p?.spy_return_pct === "number"
                    ? p.open_picks_return_pct - p.spy_return_pct
                    : null;
                const coverage = coverageNote(p);
                return (
                  <tr key={id} className="border-b border-border last:border-b-0">
                    <th scope="row" className="px-4 py-3 text-left">
                      <span className="block font-sans text-[13px] font-semibold text-text">
                        {PERIOD_TAB_LABEL[id]}
                      </span>
                      <span className="block font-sans text-[10px] font-normal text-text-dim">
                        {periodCaption(p)}
                        {coverage ? ` · ${coverage}` : ""}
                      </span>
                    </th>
                    <td className={`px-4 py-3 text-right font-mono text-[13px] font-semibold tabular-nums ${pnlClass(p?.open_picks_return_pct)}`}>
                      {formatPctOrDash(p?.open_picks_return_pct)}
                    </td>
                    <td className={`px-4 py-3 text-right font-mono text-[13px] tabular-nums ${pnlClass(p?.spy_return_pct)}`}>
                      {formatPctOrDash(p?.spy_return_pct)}
                    </td>
                    <td className={`px-4 py-3 text-right font-mono text-[12px] tabular-nums ${pnlClass(diff)}`}>
                      {pts(diff, 2)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="mt-auto border-t border-border px-4 py-3 font-sans text-[10px] leading-relaxed text-text-dim">
            Picks held now, value weighted. A pick bought inside the period is
            left out rather than counted from its entry.
          </p>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Monthly returns
// ---------------------------------------------------------------------------

/** Heat for a monthly return. Literal classes so Tailwind can see them. */
function heat(v: number | null): string {
  if (v === null) return "";
  const a = Math.abs(v);
  if (a < 0.05) return "";
  if (v > 0) return a >= 5 ? "bg-accent-green/30" : a >= 2 ? "bg-accent-green/20" : "bg-accent-green/10";
  return a >= 5 ? "bg-accent-red/30" : a >= 2 ? "bg-accent-red/20" : "bg-accent-red/10";
}

function MonthCell({
  m,
  value,
  shaded,
  bold,
  asPts = false,
}: {
  m: MonthReturn | null;
  value: number | null;
  shaded: boolean;
  bold: boolean;
  asPts?: boolean;
}) {
  if (!m) return <td className="px-1.5 py-2 text-center font-mono text-[11px] text-text-dim/40">·</td>;
  const text =
    value === null
      ? "—"
      : asPts
        ? `${value > 0 ? "+" : ""}${value.toFixed(1)}`
        : `${value > 0 ? "+" : ""}${value.toFixed(1)}%`;
  return (
    <td
      className={`px-1.5 py-2 text-center font-mono text-[11px] tabular-nums ${shaded ? heat(value) : ""} ${
        bold ? "font-semibold text-text" : pnlClass(value)
      }`}
      title={m.partial ? `${formatMonth(m.month)}, partial month` : formatMonth(m.month)}
    >
      {text}
      {m.partial && <sup className="ml-px text-[8px] text-text-dim">*</sup>}
    </td>
  );
}

/**
 * The month-by-month grid every fund factsheet leads its numbers with. Each
 * month is its own window, rebuilt server-side from the prior month's close,
 * so a cell is that month's return — not a slice of the cumulative curve.
 */
export function MonthlyReturns() {
  const { data, isPending, isError, error, refetch } = useTrackRecord();
  const grid = monthGrid(data?.months ?? []);
  const state = resolveDataState({
    isPending,
    isError,
    error,
    isEmpty: grid.length === 0,
  });
  const hasPartial = data?.months.some((m) => m.partial);

  return (
    <div className="data-panel">
      <PanelHeader label="Monthly returns" tone="mint">
        <span className="font-mono text-[10px] text-text-dim">PICKS VS S&amp;P 500</span>
      </PanelHeader>
      {hasDataState(state) ? (
        <DataState
          state={state}
          error={error}
          onRetry={() => void refetch()}
          emptyTitle="No months yet"
          emptyMessage="Monthly returns appear once the book has marks."
          compact
        />
      ) : (
        <>
          <HScroll>
            <table className="w-full min-w-[760px]">
              <thead>
                <tr className="border-b border-border">
                  <th scope="col" className="sticky-col px-4 py-2.5 text-left font-sans text-[10px] font-bold tracking-[0.12em] text-text-dim">
                    YEAR
                  </th>
                  {MONTHS.map((mo) => (
                    <th key={mo} scope="col" className="px-1.5 py-2.5 text-center font-sans text-[10px] font-bold tracking-[0.08em] text-text-dim">
                      {mo.toUpperCase()}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {grid.map((row) => (
                  <Fragment key={row.year}>
                    {(
                      [
                        ["Picks", (m: MonthReturn) => m.picks_pct, true, false],
                        ["S&P 500", (m: MonthReturn) => m.spy_pct, false, false],
                        [
                          "Diff (pts)",
                          (m: MonthReturn) =>
                            m.picks_pct !== null && m.spy_pct !== null
                              ? m.picks_pct - m.spy_pct
                              : null,
                          false,
                          true,
                        ],
                      ] as const
                    ).map(([label, pick, shaded, isDiff], i) => (
                      <tr
                        key={label}
                        className={i === 2 ? "border-b border-border last:border-b-0" : ""}
                      >
                        <th scope="row" className="sticky-col whitespace-nowrap px-4 py-2 text-left">
                          {i === 0 && (
                            <span className="mr-2 font-mono text-[12px] font-semibold text-text">
                              {row.year}
                            </span>
                          )}
                          <span className={`font-sans text-[11px] ${i === 0 ? "font-semibold text-text-muted" : "font-normal text-text-dim"}`}>
                            {label}
                          </span>
                        </th>
                        {row.cells.map((m, idx) => (
                          <MonthCell
                            key={idx}
                            m={m}
                            value={m ? pick(m) : null}
                            shaded={shaded}
                            bold={false}
                            asPts={isDiff}
                          />
                        ))}
                      </tr>
                    ))}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </HScroll>
          <p className="border-t border-border px-5 py-3 font-sans text-[10px] leading-relaxed text-text-dim">
            Each month opens at the prior month&apos;s final close, with every
            pick then held re-entered at its value that day; the S&amp;P column
            gets the same dollars on the same dates.
            {hasPartial &&
              " * Partial month: the first runs from the first pick, the latest to the most recent close."}
          </p>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Pick scorecard
// ---------------------------------------------------------------------------

type ScoreSortKey = "ticker" | "return" | "spy" | "excess" | "held" | "entry";
type StatusFilter = "all" | "active" | "closed";

const SCORE_COLUMNS: readonly Column<ScoreSortKey>[] = [
  { label: "PICK", sortKey: "ticker" },
  { label: "RETURN", sortKey: "return" },
  { label: "S&P 500", sortKey: "spy", note: "same dates" },
  { label: "VS S&P", sortKey: "excess" },
  { label: "HELD", sortKey: "held" },
  { label: "ENTRY", sortKey: "entry" },
  { label: "EXIT" },
];

/** A centred bar for the excess: right and green ahead, left and red behind. */
function ExcessBar({ value, scale }: { value: number | null; scale: number }) {
  if (value === null) return null;
  const w = Math.min(50, (Math.abs(value) / scale) * 50);
  return (
    <span className="relative hidden h-1.5 w-20 rounded-full bg-bg-tertiary md:block" aria-hidden>
      <span className="absolute inset-y-0 left-1/2 w-px bg-border-strong" />
      <span
        className={`absolute inset-y-0 rounded-full ${value >= 0 ? "bg-accent-green" : "bg-accent-red"}`}
        style={value >= 0 ? { left: "50%", width: `${w}%` } : { right: "50%", width: `${w}%` }}
      />
    </span>
  );
}

/**
 * Every pick against the S&P 500 over its own holding period — the scorecard
 * format the long-running newsletters publish. A book can beat the index on
 * two outliers while most picks trail it; this is the only view that shows it.
 */
export function PickScorecard() {
  const { data, isPending, isError, error, refetch } = useTrackRecord();
  const [filter, setFilter] = useState<StatusFilter>("all");
  const [sortKey, setSortKey] = useState<ScoreSortKey>("excess");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const asOf = data?.as_of ?? new Date().toISOString().slice(0, 10);
  const rows = (data?.picks ?? []).map((p) => ({ p, held: daysHeld(p, asOf) }));
  const filtered = rows.filter((r) => filter === "all" || r.p.status === filter);

  const valueOf = (r: (typeof rows)[number]): number | null => {
    switch (sortKey) {
      case "return":
        return r.p.return_pct;
      case "spy":
        return r.p.spy_pct;
      case "excess":
        return r.p.excess_pct;
      case "held":
        return r.held;
      default:
        return null;
    }
  };
  const sorted = [...filtered].sort((a, b) => {
    if (sortKey === "ticker" || sortKey === "entry") {
      const cmp =
        sortKey === "ticker"
          ? a.p.ticker.localeCompare(b.p.ticker)
          : (a.p.entry_date ?? "").localeCompare(b.p.entry_date ?? "");
      return sortDir === "asc" ? cmp : -cmp;
    }
    return comparePnl(valueOf(a), valueOf(b), sortDir);
  });

  const scale = Math.max(
    10,
    ...rows.map((r) => Math.abs(r.p.excess_pct ?? 0)),
  );

  const toggleSort = (key: ScoreSortKey) => {
    if (key === sortKey) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else {
      setSortKey(key);
      setSortDir(key === "ticker" ? "asc" : "desc");
    }
  };

  const state = resolveDataState({
    isPending,
    isError,
    error,
    isEmpty: rows.length === 0,
  });

  return (
    <div className="data-panel">
      <PanelHeader label="Pick scorecard" tone="yellow">
        <div className="flex flex-wrap items-center gap-3">
          <FilterChips
            options={["all", "active", "closed"] as const}
            value={filter}
            onChange={setFilter}
            label="Filter picks by status"
            labelFor={(f) => (f === "active" ? "Open" : f === "closed" ? "Closed" : "All")}
          />
          <span className="font-mono text-[10px] text-text-dim">
            {isPending || isError ? "—" : `${filtered.length} PICKS`}
          </span>
        </div>
      </PanelHeader>
      <HScroll>
        <table className="w-full">
          <SortableHead
            columns={SCORE_COLUMNS}
            sortKey={sortKey}
            sortDir={sortDir}
            onSort={toggleSort}
            stickyFirst
          />
          <tbody>
            {hasDataState(state) ? (
              <DataStateRow
                colSpan={SCORE_COLUMNS.length}
                state={state}
                error={error}
                onRetry={() => void refetch()}
                emptyTitle="No picks yet"
                emptyMessage="Every pick appears here with its return against the S&P 500 over the same dates."
              />
            ) : sorted.length === 0 ? (
              <FilteredOutRow colSpan={SCORE_COLUMNS.length} />
            ) : (
              sorted.map(({ p, held }, i) => (
                <tr
                  key={`${p.ticker}-${p.entry_date}-${i}`}
                  className="group border-b border-border transition-colors duration-100 last:border-b-0 hover:bg-bg-tertiary/50"
                >
                  <td className="sticky-col px-3 py-3 group-hover:bg-bg-tertiary sm:px-5">
                    <span className="flex items-center gap-2.5">
                      <CompanyLogo ticker={p.ticker} size="sm" />
                      <span>
                        <span className="block font-mono text-[14px] font-semibold text-text">
                          {p.ticker}
                        </span>
                        <span className="block font-sans text-[10px] text-text-dim">
                          {p.status === "closed" ? "Closed" : "Open"}
                        </span>
                      </span>
                    </span>
                  </td>
                  <td className={`whitespace-nowrap px-3 py-3 font-mono text-[13px] font-semibold tabular-nums sm:px-5 ${pnlClass(p.return_pct)}`}>
                    {formatPctOrDash(p.return_pct, 1)}
                  </td>
                  <td className={`whitespace-nowrap px-3 py-3 font-mono text-[12px] tabular-nums sm:px-5 ${pnlClass(p.spy_pct)}`}>
                    {formatPctOrDash(p.spy_pct, 1)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 sm:px-5">
                    <span className="flex items-center gap-3">
                      <span className={`w-[72px] font-mono text-[12px] font-semibold tabular-nums ${pnlClass(p.excess_pct)}`}>
                        {pts(p.excess_pct)}
                      </span>
                      <ExcessBar value={p.excess_pct} scale={scale} />
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 font-mono text-[12px] tabular-nums text-text-muted sm:px-5">
                    {held === null ? "—" : `${held}d`}
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 font-mono text-[12px] text-text-muted sm:px-5">
                    {p.entry_date ?? "—"}
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 font-mono text-[12px] text-text-muted sm:px-5">
                    {p.exit_date ?? "—"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </HScroll>
      <p className="border-t border-border px-5 py-3 font-sans text-[10px] leading-relaxed text-text-dim">
        S&amp;P 500 is SPY from the close on the pick&apos;s entry date to the
        close on its exit, or the latest close for an open pick. &ldquo;vs
        S&amp;P&rdquo; is the difference in percentage points. Pick returns are
        against average cost, the same figure shown on Positions.
      </p>
    </div>
  );
}
