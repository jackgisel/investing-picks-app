"use client";

import Link from "next/link";
import { useState, useMemo } from "react";
import { usePicks } from "@/lib/hooks/use-picks";
import {
  DataStateRow,
  hasDataState,
  resolveDataState,
} from "@/components/ui/data-state";
import { Filter, ArrowUpDown } from "lucide-react";
import { formatPct } from "@/lib/portfolio";
import { getInsightSlugByTicker } from "@/lib/insight-links";

type SortKey = "pnl_pct" | "entry_date" | "ticker";
type SortDir = "asc" | "desc";
type StatusFilter = "all" | "active" | "closed";

export default function PicksPage() {
  const active = usePicks("active");
  const closed = usePicks("closed");
  const { data: activeData } = active;
  const { data: closedData } = closed;
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [sortKey, setSortKey] = useState<SortKey>("entry_date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  // Two queries, one table. The page is only usable when both have landed, and
  // either failing is a failure of the whole table — they hit the same gated
  // endpoint, so they fail the same way in practice.
  const isPending = active.isPending || closed.isPending;
  const isError = active.isError || closed.isError;
  const error = active.error ?? closed.error;
  const retry = () => {
    void active.refetch();
    void closed.refetch();
  };

  const allPicks = useMemo(() => {
    const active = (activeData?.picks ?? []).map((p) => ({ ...p, status: "active" }));
    const closed = (closedData?.picks ?? []).map((p) => ({ ...p, status: "closed" }));
    return [...active, ...closed];
  }, [activeData, closedData]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else {
      setSortKey(key);
      setSortDir("desc");
    }
  };

  const filtered = allPicks
    .filter((p) => statusFilter === "all" || p.status === statusFilter)
    .sort((a, b) => {
      let cmp = 0;
      if (sortKey === "ticker") cmp = a.ticker.localeCompare(b.ticker);
      else if (sortKey === "pnl_pct") cmp = (a.pnl_pct ?? 0) - (b.pnl_pct ?? 0);
      else if (sortKey === "entry_date") cmp = a.entry_date.localeCompare(b.entry_date);
      return sortDir === "asc" ? cmp : -cmp;
    });

  const activeCount = activeData?.count ?? 0;
  const closedCount = closedData?.count ?? 0;

  const state = resolveDataState({
    isPending,
    isError,
    error,
    isEmpty: allPicks.length === 0,
  });
  // Distinct from `state === "empty"`: the query succeeded and returned picks,
  // the user just narrowed them all away with the status filter.
  const filteredOut = !state && filtered.length === 0;

  return (
    <div className="max-w-[1100px] space-y-6">
      <div>
        <h1 className="font-sans text-xl font-bold">Pick History</h1>
        <p className="font-sans text-[13px] text-text-dim mt-1">
          {isPending
            ? "Loading..."
            : isError
              ? "Pick history unavailable"
              : `${activeCount} active · ${closedCount} closed`}
        </p>
      </div>

      <div className="soft-card !p-0 overflow-hidden">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between px-5 py-4 border-b border-border gap-3">
          <div className="flex items-center gap-2">
            <Filter size={12} className="text-text-dim" />
            {(["all", "active", "closed"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setStatusFilter(f)}
                className={`font-sans text-[10px] font-bold tracking-[0.1em] uppercase px-3.5 py-1.5 rounded-pill transition-colors ${
                  statusFilter === f
                    ? "bg-inverse text-inverse-fg"
                    : "text-text-dim hover:text-text bg-bg border border-border"
                }`}
              >
                {f.toUpperCase()}
              </button>
            ))}
          </div>
          <span className="font-mono text-[10px] text-text-dim">
            {isPending || isError ? "—" : `${filtered.length} RESULTS`}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                {(
                  [
                    { key: "ticker" as SortKey, label: "TICKER" },
                    { key: null, label: "STATUS" },
                    { key: "entry_date" as SortKey, label: "ENTRY DATE" },
                    { key: null, label: "EXIT DATE" },
                    { key: "pnl_pct" as SortKey, label: "RETURN" },
                    { key: null, label: "EXIT REASON" },
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
                  onRetry={retry}
                  emptyTitle="No picks published yet"
                  emptyMessage="Picks appear here the moment the first one is published. Nothing has been closed out yet either."
                />
              ) : filteredOut ? (
                <tr>
                  <td colSpan={6} className="px-5 py-8 text-center">
                    <span className="font-mono text-[11px] text-text-dim">
                      NO PICKS MATCH FILTERS
                    </span>
                  </td>
                </tr>
              ) : (
                filtered.map((p, i) => {
                  const insightSlug =
                    p.blog_slug ?? getInsightSlugByTicker(p.ticker);
                  return (
                    <tr
                      key={`${p.ticker}-${p.entry_date}-${i}`}
                      className="border-b border-border last:border-b-0 hover:bg-bg-tertiary/50 transition-colors"
                    >
                      <td className="px-5 py-3.5">
                        {insightSlug ? (
                          <Link
                            href={`/insights/${insightSlug}`}
                            className="font-mono font-semibold text-[14px] text-text underline underline-offset-2 hover:opacity-70 underline-offset-4"
                          >
                            {p.ticker}
                          </Link>
                        ) : (
                          <span className="font-mono font-semibold text-[14px]">
                            {p.ticker}
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3.5">
                        <span
                          className={`badge ${
                            p.status === "active" ? "badge-buy" : "badge-sell"
                          }`}
                        >
                          {p.status.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 font-mono text-[12px] text-text-muted">
                        {p.entry_date}
                      </td>
                      <td className="px-5 py-3.5 font-mono text-[12px] text-text-muted">
                        {p.exit_date ?? "—"}
                      </td>
                      <td
                        className={`px-5 py-3.5 font-mono text-[13px] font-semibold ${
                          (p.pnl_pct ?? 0) >= 0
                            ? "text-accent-green"
                            : "text-accent-red"
                        }`}
                      >
                        {formatPct(p.pnl_pct ?? 0)}
                      </td>
                      <td className="px-5 py-3.5 font-sans text-[11px] text-text-dim max-w-[220px] truncate">
                        {p.exit_reason || "—"}
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
