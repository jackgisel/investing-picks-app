"use client";

import { useState } from "react";
import { CalendarDays, LineChart, Sparkles } from "lucide-react";
import {
  usePeriodReturns,
  type PeriodId,
  type PeriodSummary,
} from "@/lib/hooks/use-period-returns";
import {
  DataStateRow,
  hasDataState,
  resolveDataState,
} from "@/components/ui/data-state";
import {
  FilterChips,
  PanelHeader,
  SortableHead,
  type Column,
  type SortDir,
} from "@/components/dashboard/data-table";
import { HScroll } from "@/components/ui/h-scroll";
import { CompanyLogo } from "@/components/ui/company-logo";
import { formatPctOrDash, formatWeekdayDate, pnlClass } from "@/lib/portfolio";
import {
  PERIOD_ORDER,
  PERIOD_TAB_LABEL,
  coverageNote,
  partialNote,
  periodCaption,
  sortByPeriod,
} from "@/lib/period-returns";
import { TONE_TINT } from "@/lib/tones";

/**
 * Short-horizon performance: today, this week, this month.
 *
 * The equity curve answers "was the strategy right"; it cannot answer "what is
 * happening this week", which is the question a subscriber actually opens the
 * dashboard with. Three periods rather than one because a single number is
 * unreadable on its own — a pick down 4% today after +18% this month is a very
 * different position from one down 4% today and -18% this month.
 *
 * Every period is anchored on the last SESSION before it opened (Friday's close
 * for the week), and each tile says so under the number. See
 * `app/services/period_returns.py` for why.
 */

type SortKey = "ticker" | PeriodId;

function PeriodTile({
  label,
  caption,
  value,
  note,
  icon: Icon,
  tone,
  loading,
}: {
  label: string;
  caption: string;
  value: number | null | undefined;
  note?: string | null;
  icon: React.ElementType;
  tone: "mint" | "cyan" | "lilac";
  loading: boolean;
}) {
  return (
    <div className="data-card">
      <div className="mb-2.5 flex items-center gap-2">
        <span
          className={`inline-flex items-center justify-center rounded-lg p-1.5 ${TONE_TINT[tone]}`}
          aria-hidden
        >
          <Icon size={13} className="text-text-muted" />
        </span>
        <span className="field-label">{label}</span>
      </div>
      {loading ? (
        <span className="block h-[26px] w-20 animate-pulse rounded bg-bg-tertiary" />
      ) : (
        <span
          className={`block font-mono text-xl font-bold leading-[26px] tabular-nums ${pnlClass(value)}`}
        >
          {formatPctOrDash(value)}
        </span>
      )}
      <span className="mt-1.5 block font-sans text-[11px] text-text-dim">
        {caption}
      </span>
      {note && (
        <span className="mt-0.5 block font-sans text-[10px] text-text-dim">
          {note}
        </span>
      )}
    </div>
  );
}

export function PeriodTiles({
  summary,
  loading,
}: {
  summary: PeriodSummary | undefined;
  loading: boolean;
}) {
  const caption = periodCaption(summary);
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      <PeriodTile
        label="Picks held"
        caption={caption}
        value={summary?.open_picks_return_pct}
        note={coverageNote(summary)}
        icon={Sparkles}
        tone="mint"
        loading={loading}
      />
      <PeriodTile
        label="Book"
        caption={`${caption} · cash included`}
        value={summary?.book_return_pct}
        icon={LineChart}
        tone="cyan"
        loading={loading}
      />
      <PeriodTile
        label="S&P 500"
        caption={caption}
        value={summary?.spy_return_pct}
        icon={CalendarDays}
        tone="lilac"
        loading={loading}
      />
    </div>
  );
}

export function PeriodPerformance() {
  const [period, setPeriod] = useState<PeriodId>("day");
  const [sortKey, setSortKey] = useState<SortKey>("day");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const query = usePeriodReturns();
  const { data, isPending, isError, error } = query;
  const rows = data?.positions;

  // Picking a period re-sorts the table by it: the chips are a "show me this
  // window" control, and leaving the table sorted by yesterday's column would
  // make the selection look like it did nothing.
  const choosePeriod = (next: PeriodId) => {
    setPeriod(next);
    setSortKey(next);
    setSortDir("desc");
  };

  const toggleSort = (key: SortKey) => {
    if (key === sortKey) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else {
      setSortKey(key);
      setSortDir("desc");
    }
  };

  const summary = data?.periods.find((p) => p.id === period);

  const columns: readonly Column<SortKey>[] = [
    { label: "TICKER", sortKey: "ticker" },
    { label: "SECTOR" },
    ...PERIOD_ORDER.map((id) => ({
      label: PERIOD_TAB_LABEL[id].toUpperCase(),
      sortKey: id as SortKey,
      note:
        formatWeekdayDate(data?.periods.find((p) => p.id === id)?.from_date) ??
        undefined,
    })),
  ];

  const sorted = rows
    ? sortKey === "ticker"
      ? [...rows].sort((a, b) =>
          sortDir === "asc"
            ? a.ticker.localeCompare(b.ticker)
            : b.ticker.localeCompare(a.ticker),
        )
      : sortByPeriod(rows, sortKey, sortDir)
    : undefined;

  const state = resolveDataState({
    isPending,
    isError,
    error,
    isEmpty: (rows?.length ?? 0) === 0,
  });

  return (
    <div className="space-y-4 pt-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <FilterChips
          options={PERIOD_ORDER}
          value={period}
          onChange={choosePeriod}
          label="Performance period"
          labelFor={(id) => PERIOD_TAB_LABEL[id]}
        />
        <span className="font-mono text-[10px] text-text-dim">
          {data?.as_of
            ? `AS OF ${formatWeekdayDate(data.as_of)?.toUpperCase()}`
            : "—"}
        </span>
      </div>

      <PeriodTiles summary={summary} loading={isPending} />

      <div className="data-panel">
        <PanelHeader label={`${PERIOD_TAB_LABEL[period]} by position`} tone="mint">
          <span className="font-mono text-[10px] text-text-dim">
            {isPending || isError ? "—" : `${sorted?.length ?? 0} HOLDINGS`}
          </span>
        </PanelHeader>

        <HScroll>
          <table className="w-full">
            <SortableHead
              columns={columns}
              sortKey={sortKey}
              sortDir={sortDir}
              onSort={toggleSort}
              stickyFirst
            />
            <tbody>
              {hasDataState(state) ? (
                <DataStateRow
                  colSpan={columns.length}
                  state={state}
                  error={error}
                  onRetry={() => void query.refetch()}
                  emptyTitle="No open positions"
                  emptyMessage="Period performance is measured on the positions the book holds. New positions appear here the session after they are opened."
                />
              ) : (
                sorted?.map((row) => (
                  <tr
                    key={row.ticker}
                    className="group border-b border-border transition-colors last:border-b-0 hover:bg-bg-tertiary/50"
                  >
                    <td className="sticky-col px-3 py-3.5 group-hover:bg-bg-tertiary sm:px-5">
                      <span className="flex items-center gap-2.5">
                        <CompanyLogo ticker={row.ticker} size="sm" />
                        <span className="font-mono text-[14px] font-semibold">
                          {row.ticker}
                        </span>
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-3 py-3.5 font-sans text-[12px] text-text-muted sm:px-5">
                      {row.sector?.trim() || (
                        <span className="text-text-dim">Unclassified</span>
                      )}
                    </td>
                    {PERIOD_ORDER.map((id) => {
                      const cell = row.periods[id];
                      const note = partialNote(row, id);
                      return (
                        <td
                          key={id}
                          className={`whitespace-nowrap px-3 py-3.5 sm:px-5${
                            id === period ? " bg-bg-tertiary/40" : ""
                          }`}
                        >
                          <span
                            className={`block font-mono text-[13px] font-semibold tabular-nums ${pnlClass(
                              cell?.return_pct,
                            )}`}
                          >
                            {formatPctOrDash(cell?.return_pct)}
                          </span>
                          {/*
                            A position bought inside the window has no price of
                            ours at the anchor, so this is "since we bought it",
                            not "this month". Unlabelled, the two read the same.
                          */}
                          {note && (
                            <span className="mt-0.5 block font-sans text-[9px] tracking-[0.04em] text-text-dim">
                              {note.toUpperCase()}
                            </span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </HScroll>
      </div>
    </div>
  );
}

