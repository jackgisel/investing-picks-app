"use client";

import { useState } from "react";
import Link from "next/link";
import { FileText } from "lucide-react";
import { useStrategy } from "@/lib/hooks/use-strategy";
import { usePicks } from "@/lib/hooks/use-picks";
import {
  DataStateRow,
  hasDataState,
  resolveDataState,
} from "@/components/ui/data-state";
import { SectorAllocation } from "@/components/dashboard/sector-allocation";
import {
  PanelHeader,
  SortableHead,
  type Column,
  type SortDir,
} from "@/components/dashboard/data-table";
import { formatDayMonth, formatPctOrDash, pnlClass } from "@/lib/portfolio";
import { getInsightByTicker } from "@/lib/insight-index";

type SortKey = "ticker" | "sector" | "weight_pct" | "entry_date" | "pnl_pct";

/**
 * `ratingNote` stamps the RATING column with the date those ratings were
 * struck. The universe is scored on a schedule, not on page load, so a badge
 * with no date on it reads as the strategy's view *today* however old it is —
 * which is the reading that matters least when someone is deciding whether to
 * add to a position.
 */
function buildColumns(ratingNote: string | null): readonly Column<SortKey>[] {
  return [
    { label: "TICKER", sortKey: "ticker" },
    { label: "SECTOR", sortKey: "sector" },
    { label: "WEIGHT", sortKey: "weight_pct" },
    { label: "RATING", note: ratingNote ?? undefined },
    { label: "ENTRY DATE", sortKey: "entry_date" },
    { label: "DAYS HELD" },
    { label: "RETURN", sortKey: "pnl_pct" },
  ];
}

function daysHeld(entryDate: string | null): string {
  if (!entryDate) return "—";
  const start = new Date(entryDate).getTime();
  if (Number.isNaN(start)) return "—";
  return `${Math.max(0, Math.floor((Date.now() - start) / 86400000))}d`;
}

/** Buy-ish ratings read green, sell-ish red, hold neutral. */
function signalBadgeClass(signal: string): string {
  if (signal === "strong_buy" || signal === "buy") return "badge-buy";
  if (signal === "hold") return "badge-hold";
  return "badge-sell";
}

export function PositionsOpen() {
  const strategyQuery = useStrategy();
  const picksQuery = usePicks("active");
  const { data: strategy, isPending, isError, error } = strategyQuery;
  const holdings = strategy?.holdings;

  const [sortKey, setSortKey] = useState<SortKey>("pnl_pct");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else {
      setSortKey(key);
      setSortDir("desc");
    }
  };

  // The strategy endpoint knows sector and weight; the picks endpoint knows the
  // current rating. Joining them here is what let Portfolio and Pick history be
  // one table instead of two pages showing the same rows.
  const signalByTicker = new Map(
    (picksQuery.data?.picks ?? []).map((p) => [p.ticker, p.signal]),
  );

  const ratingAsOf = picksQuery.data?.rating_as_of ?? null;
  const ratingDate = formatDayMonth(ratingAsOf);
  const columns = buildColumns(ratingDate && `as of ${ratingDate}`);

  const sorted = holdings
    ? [...holdings].sort((a, b) => {
        let cmp = 0;
        if (sortKey === "ticker")
          cmp = (a.ticker ?? "").localeCompare(b.ticker ?? "");
        else if (sortKey === "pnl_pct") cmp = a.pnl_pct - b.pnl_pct;
        else if (sortKey === "weight_pct")
          cmp = (a.weight_pct ?? 0) - (b.weight_pct ?? 0);
        else if (sortKey === "sector")
          cmp = (a.sector ?? "").localeCompare(b.sector ?? "");
        else if (sortKey === "entry_date")
          cmp = (a.entry_date ?? "").localeCompare(b.entry_date ?? "");
        return sortDir === "asc" ? cmp : -cmp;
      })
    : undefined;

  const state = resolveDataState({
    isPending,
    isError,
    error,
    isEmpty: (holdings?.length ?? 0) === 0,
  });

  return (
    <div className="space-y-4 pt-4">
      {holdings && holdings.length > 0 && (
        <SectorAllocation
          holdings={holdings}
          sectorCap={
            typeof strategy?.params?.sector_concentration === "number"
              ? strategy.params.sector_concentration
              : null
          }
          maxPositions={strategy?.strategy?.max_positions ?? null}
        />
      )}

      <div className="data-panel">
        <PanelHeader label="Open positions" tone="mint">
          <span className="font-mono text-[10px] text-text-dim">
            {isPending || isError ? "—" : `${sorted?.length ?? 0} HOLDINGS`}
          </span>
        </PanelHeader>

        <div className="overflow-x-auto">
          <table className="w-full">
            <SortableHead
              columns={columns}
              sortKey={sortKey}
              sortDir={sortDir}
              onSort={toggleSort}
            />
            <tbody>
              {hasDataState(state) ? (
                <DataStateRow
                  colSpan={columns.length}
                  state={state}
                  error={error}
                  onRetry={() => void strategyQuery.refetch()}
                  emptyTitle="No open positions"
                  emptyMessage="The book has no open positions right now. New positions appear here as soon as they are opened."
                />
              ) : (
                sorted?.map((h) => {
                  const slug = getInsightByTicker(h.ticker)?.slug;
                  const signal = h.ticker
                    ? signalByTicker.get(h.ticker)
                    : undefined;
                  return (
                    <tr
                      key={h.ticker ?? h.entry_date ?? "row"}
                      className="border-b border-border transition-colors last:border-b-0 hover:bg-bg-tertiary/50"
                    >
                      <td className="px-5 py-3.5">
                        <span className="flex items-center gap-2">
                          {slug ? (
                            <Link
                              href={`/dashboard/insights/${slug}`}
                              title="Read the research note"
                              className="inline-flex items-center gap-1.5 font-mono text-[14px] font-semibold text-text underline underline-offset-4 hover:opacity-70"
                            >
                              {h.ticker}
                              <FileText
                                size={11}
                                className="text-accent-lilac"
                              />
                            </Link>
                          ) : (
                            <span className="font-mono text-[14px] font-semibold">
                              {h.ticker ?? "—"}
                            </span>
                          )}
                          {h.is_house_money && (
                            <span
                              className="badge badge-buy !px-2 !text-[9px]"
                              title="The original stake has already been recovered via a Winners Circle partial sell — this position is running on profit."
                            >
                              House
                            </span>
                          )}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-5 py-3.5 font-sans text-[12px] text-text-muted">
                        {h.sector?.trim() || (
                          <span className="text-text-dim">Unclassified</span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 font-mono text-[12px] tabular-nums text-text-muted">
                        {typeof h.weight_pct === "number"
                          ? `${h.weight_pct.toFixed(1)}%`
                          : "—"}
                      </td>
                      <td className="px-5 py-3.5">
                        {signal ? (
                          <span
                            className={`badge ${signalBadgeClass(signal)}`}
                            title={
                              ratingAsOf
                                ? `The strategy's read on ${h.ticker} as of ${ratingAsOf}. Ratings are re-struck each trading day, not live.`
                                : undefined
                            }
                          >
                            {signal.replace("_", " ").toUpperCase()}
                          </span>
                        ) : (
                          <span
                            className="font-mono text-[11px] text-text-dim"
                            title="This name has no score in the latest run, so the strategy has no rating to publish for it."
                          >
                            unrated
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 font-mono text-[12px] text-text-muted">
                        {h.entry_date ?? "—"}
                      </td>
                      <td className="px-5 py-3.5 font-mono text-[12px] tabular-nums text-text-muted">
                        {daysHeld(h.entry_date)}
                      </td>
                      <td
                        className={`px-5 py-3.5 font-mono text-[13px] font-semibold tabular-nums ${pnlClass(
                          h.pnl_pct,
                        )}`}
                      >
                        {formatPctOrDash(h.pnl_pct)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
