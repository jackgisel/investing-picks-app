"use client";

import { useState, useMemo } from "react";
import { usePicks, type Pick } from "@/lib/hooks/use-picks";
import { Filter, ArrowUpDown } from "lucide-react";

type SortKey = "pnl_pct" | "entry_date" | "dollar_pnl" | "ticker";
type SortDir = "asc" | "desc";
type SourceFilter = "all" | "backtest" | "live";

function formatPct(n: number) {
  const sign = n >= 0 ? "+" : "";
  return `${sign}${n.toFixed(2)}%`;
}

function formatDollar(n: number) {
  const sign = n >= 0 ? "+" : "";
  if (Math.abs(n) >= 1000) return `${sign}$${(n / 1000).toFixed(1)}K`;
  return `${sign}$${n.toFixed(0)}`;
}

export default function PicksPage() {
  const { data: activeData, isLoading: loadingActive } = usePicks("active");
  const { data: closedData, isLoading: loadingClosed } = usePicks("closed");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "closed">("all");
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("backtest");
  const [sortKey, setSortKey] = useState<SortKey>("entry_date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const isLoading = loadingActive || loadingClosed;

  const allPicks = useMemo(() => {
    const active = (activeData?.picks ?? []).map((p) => ({ ...p, status: "active" }));
    const closed = (closedData?.picks ?? []).map((p) => ({ ...p, status: "closed" }));
    return [...active, ...closed];
  }, [activeData, closedData]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("desc"); }
  };

  const filtered = allPicks
    .filter((p) => statusFilter === "all" || p.status === statusFilter)
    .filter((p) => sourceFilter === "all" || p.source === sourceFilter)
    .sort((a, b) => {
      let cmp = 0;
      if (sortKey === "ticker") cmp = a.ticker.localeCompare(b.ticker);
      else if (sortKey === "pnl_pct") cmp = (a.pnl_pct ?? 0) - (b.pnl_pct ?? 0);
      else if (sortKey === "dollar_pnl") cmp = (a.dollar_pnl ?? 0) - (b.dollar_pnl ?? 0);
      else if (sortKey === "entry_date") cmp = a.entry_date.localeCompare(b.entry_date);
      return sortDir === "asc" ? cmp : -cmp;
    });

  return (
    <div className="max-w-[1100px] space-y-6">
      <div>
        <h1 className="font-sans text-xl font-bold">Pick History</h1>
        <p className="font-sans text-[13px] text-text-dim mt-1">
          {isLoading ? "Loading..." : `${allPicks.length} total picks`}
        </p>
      </div>

      <div className="bg-bg-secondary border border-border overflow-hidden">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between px-5 py-4 border-b border-border gap-3">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Filter size={12} className="text-text-dim" />
              {(["all", "active", "closed"] as const).map((f) => (
                <button key={f} onClick={() => setStatusFilter(f)}
                  className={`font-mono text-[10px] px-3 py-1 tracking-wider transition-colors ${statusFilter === f ? "bg-bg-tertiary text-text border border-border-light" : "text-text-dim hover:text-text-muted"}`}>
                  {f.toUpperCase()}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              {(["all", "backtest", "live"] as const).map((f) => (
                <button key={f} onClick={() => setSourceFilter(f)}
                  className={`font-mono text-[10px] px-3 py-1 tracking-wider transition-colors ${sourceFilter === f ? "bg-bg-tertiary text-text border border-border-light" : "text-text-dim hover:text-text-muted"}`}>
                  {f.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
          <span className="font-mono text-[10px] text-text-dim">{filtered.length} RESULTS</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                {([
                  { key: "ticker" as SortKey, label: "TICKER" },
                  { key: null, label: "STATUS" },
                  { key: "entry_date" as SortKey, label: "ENTRY" },
                  { key: null, label: "ENTRY $" },
                  { key: null, label: "CURRENT $" },
                  { key: "pnl_pct" as SortKey, label: "RETURN" },
                  { key: "dollar_pnl" as SortKey, label: "P&L" },
                  { key: null, label: "FROM PEAK" },
                  { key: null, label: "HOLD" },
                ] as const).map((col) => (
                  <th key={col.label} onClick={col.key ? () => toggleSort(col.key) : undefined}
                    className={`font-mono text-left px-5 py-3 text-[10px] text-text-dim tracking-[1.5px] font-medium border-b border-border bg-bg ${col.key ? "cursor-pointer hover:text-text-muted select-none" : ""}`}>
                    <span className="flex items-center gap-1">
                      {col.label}
                      {col.key && sortKey === col.key && <ArrowUpDown size={10} className="text-accent-green" />}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={9} className="px-5 py-8 text-center"><span className="font-mono text-[11px] text-text-dim animate-pulse">LOADING...</span></td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={9} className="px-5 py-8 text-center"><span className="font-mono text-[11px] text-text-dim">NO PICKS MATCH FILTERS</span></td></tr>
              ) : (
                filtered.map((p, i) => (
                  <tr key={`${p.ticker}-${p.source}-${i}`} className="border-b border-border last:border-b-0 hover:bg-bg-tertiary/50 transition-colors">
                    <td className="px-5 py-3.5"><span className="font-mono font-semibold text-[14px]">{p.ticker}</span></td>
                    <td className="px-5 py-3.5"><span className={`badge ${p.status === "active" ? "badge-buy" : "badge-sell"}`}>{p.status.toUpperCase()}</span></td>
                    <td className="px-5 py-3.5 font-mono text-[12px] text-text-muted">{p.entry_date}</td>
                    <td className="px-5 py-3.5 font-mono text-[12px]">${p.entry_price.toFixed(2)}</td>
                    <td className="px-5 py-3.5 font-mono text-[12px]">{p.exit_price ? `$${p.exit_price.toFixed(2)}` : `$${p.current_price.toFixed(2)}`}</td>
                    <td className={`px-5 py-3.5 font-mono text-[13px] font-semibold ${(p.pnl_pct ?? 0) >= 0 ? "text-accent-green" : "text-accent-red"}`}>
                      {formatPct(p.pnl_pct ?? 0)}
                    </td>
                    <td className={`px-5 py-3.5 font-mono text-[12px] font-semibold ${(p.dollar_pnl ?? 0) >= 0 ? "text-accent-green" : "text-accent-red"}`}>
                      {formatDollar(p.dollar_pnl ?? 0)}
                    </td>
                    <td className="px-5 py-3.5 font-mono text-[11px] text-text-dim">{p.from_peak_pct != null ? `${p.from_peak_pct.toFixed(1)}%` : "—"}</td>
                    <td className="px-5 py-3.5 font-mono text-[11px] text-text-dim">{p.hold_months != null ? `${p.hold_months.toFixed(1)}mo` : "—"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
