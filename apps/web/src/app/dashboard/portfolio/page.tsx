"use client";

import { useState } from "react";
import { useStrategy } from "@/lib/hooks/use-strategy";
import {
  DataStateCard,
  DataStateRow,
  hasDataState,
  resolveDataState,
} from "@/components/ui/data-state";
import { ArrowUpDown, Briefcase, Trophy, TrendingDown, TrendingUp } from "lucide-react";
import { StatTile } from "@/components/dashboard/stat-tile";
import { SectorAllocation } from "@/components/dashboard/sector-allocation";
import {
  computePortfolioReturnPct,
  formatPct,
  formatPctOrDash,
  pnlClass,
} from "@/lib/portfolio";

type SortKey = "ticker" | "pnl_pct" | "entry_date" | "weight_pct" | "sector";
type SortDir = "asc" | "desc";

function daysHeld(entryDate: string | null): string {
  if (!entryDate) return "—";
  const start = new Date(entryDate).getTime();
  if (Number.isNaN(start)) return "—";
  const days = Math.max(0, Math.floor((Date.now() - start) / (1000 * 60 * 60 * 24)));
  return `${days}d`;
}

export default function PortfolioPage() {
  const strategyQuery = useStrategy();
  const { data: strategy, isPending, isError, error } = strategyQuery;
  const holdings = strategy?.holdings;
  const portfolio = strategy?.portfolio;
  const totalReturnPct = computePortfolioReturnPct(strategy);
  const hasReturn = totalReturnPct !== null;
  const winnersCount = holdings?.filter((h) => h.pnl_pct > 0).length ?? 0;
  const losersCount = holdings?.filter((h) => h.pnl_pct < 0).length ?? 0;

  const [sortKey, setSortKey] = useState<SortKey>("pnl_pct");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else {
      setSortKey(key);
      setSortDir("desc");
    }
  };

  const sorted = holdings
    ? [...holdings].sort((a, b) => {
        let cmp = 0;
        if (sortKey === "ticker") cmp = a.ticker.localeCompare(b.ticker);
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
  // Nothing on this page is readable without the holdings, so a paywall or a
  // missing session replaces the whole body rather than decorating an empty
  // table with an upgrade prompt.
  const gate = state === "unauthenticated" || state === "subscription";

  return (
    <div className="space-y-5">
      <div>
        <h1 className="page-title">Portfolio</h1>
        <p className="font-sans text-[13px] text-text-dim mt-1">
          {gate
            ? state === "subscription"
              ? "Subscription required"
              : "Sign in to continue"
            : isError
              ? "Holdings unavailable"
              : portfolio
                ? `${portfolio.position_count} live positions`
                : "Loading..."}
        </p>
      </div>

      {gate ? (
        <DataStateCard state={state} error={error} />
      ) : (
        <>
        {/* Summary cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatTile
            label="TOTAL RETURN"
            value={hasReturn ? formatPct(totalReturnPct!) : "—"}
            icon={TrendingUp}
            tone="mint"
            valueTone={
              !hasReturn ? "neutral" : totalReturnPct! >= 0 ? "green" : "red"
            }
            loading={isPending}
          />
          <StatTile
            label="POSITIONS"
            value={portfolio?.position_count.toString() ?? "—"}
            icon={Briefcase}
            tone="cyan"
            loading={isPending}
          />
          <StatTile
            label="WINNERS"
            value={holdings ? `${winnersCount}` : "—"}
            icon={Trophy}
            tone="yellow"
            valueTone={winnersCount > 0 ? "green" : "neutral"}
            loading={isPending}
          />
          <StatTile
            label="LOSERS"
            value={holdings ? `${losersCount}` : "—"}
            icon={TrendingDown}
            tone="coral"
            valueTone={losersCount > 0 ? "red" : "neutral"}
            loading={isPending}
          />
        </div>

        {/* Sector exposure. sector and weight_pct have shipped on
            /api/v1/strategy all along and were rendered nowhere. */}
        {holdings && holdings.length > 0 && (
          <SectorAllocation
            holdings={holdings}
            sectorCap={
              typeof strategy?.params?.sector_concentration === "number"
                ? strategy.params.sector_concentration
                : null
            }
          />
        )}

        {/* Holdings table */}
        <div className="data-panel">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border">
            <span className="panel-label panel-label-mint">
              ALL HOLDINGS {isPending || isError ? "" : `(${sorted?.length ?? 0})`}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  {(
                    [
                      { key: "ticker" as SortKey, label: "TICKER" },
                      { key: "sector" as SortKey, label: "SECTOR" },
                      { key: "weight_pct" as SortKey, label: "WEIGHT" },
                      { key: "entry_date" as SortKey, label: "ENTRY DATE" },
                      { key: null, label: "DAYS HELD" },
                      { key: "pnl_pct" as SortKey, label: "RETURN" },
                    ] as const
                  ).map((col) => (
                    <th
                      key={col.label}
                      onClick={col.key ? () => toggleSort(col.key) : undefined}
                      className={`font-mono text-left px-5 py-3 text-[10px] text-text-dim tracking-[1.5px] font-medium border-b border-border bg-bg ${
                        col.key
                          ? "cursor-pointer hover:text-text-muted select-none"
                          : ""
                      }`}
                    >
                      <span className="flex items-center gap-1">
                        {col.label}
                        {col.key && sortKey === col.key && (
                          <ArrowUpDown size={10} className="text-accent-green" />
                        )}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {hasDataState(state) ? (
                  <DataStateRow
                    colSpan={6}
                    state={state}
                    error={error}
                    onRetry={() => void strategyQuery.refetch()}
                    emptyTitle="No holdings"
                    emptyMessage="The book has no open positions right now. New positions appear here as soon as they are opened."
                  />
                ) : (
                  sorted?.map((h) => (
                    <tr
                      key={h.ticker}
                      className="border-b border-border last:border-b-0 hover:bg-bg-tertiary/50 transition-colors"
                    >
                      <td className="px-5 py-3.5">
                        <span className="flex items-center gap-2">
                          <span className="font-mono font-semibold text-[14px]">
                            {h.ticker}
                          </span>
                          {h.is_house_money && (
                            <span
                              className="badge badge-buy !text-[9px] !px-2"
                              title="The original stake has already been recovered via a Winners Circle partial sell — this position is running on profit."
                            >
                              House
                            </span>
                          )}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 font-sans text-[12px] text-text-muted whitespace-nowrap">
                        {h.sector?.trim() || (
                          <span className="text-text-dim">Unclassified</span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 font-mono text-[12px] text-text-muted tabular-nums">
                        {typeof h.weight_pct === "number"
                          ? `${h.weight_pct.toFixed(1)}%`
                          : "—"}
                      </td>
                      <td className="px-5 py-3.5 font-mono text-[12px] text-text-muted">
                        {h.entry_date}
                      </td>
                      <td className="px-5 py-3.5 font-mono text-[12px] text-text-muted">
                        {daysHeld(h.entry_date)}
                      </td>
                      <td
                        className={`px-5 py-3.5 font-mono text-[13px] font-semibold ${pnlClass(
                          h.pnl_pct,
                        )}`}
                      >
                        {formatPctOrDash(h.pnl_pct)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
        </>
      )}
    </div>
  );
}

