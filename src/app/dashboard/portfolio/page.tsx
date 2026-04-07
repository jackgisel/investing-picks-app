"use client";

import { useState } from "react";
import { useStrategy } from "@/lib/hooks/use-strategy";
import { Filter, ArrowUpDown } from "lucide-react";

type SortKey = "ticker" | "backtest_pnl_pct" | "market_value" | "backtest_entry_date";
type SortDir = "asc" | "desc";
type SourceFilter = "all" | "live" | "backtest";

function formatPct(n: number | null) {
  if (n === null || n === undefined) return "—";
  const sign = n >= 0 ? "+" : "";
  return `${sign}${n.toFixed(2)}%`;
}

function formatCurrency(n: number) {
  if (n === 0) return "—";
  if (n >= 1000000) return `$${(n / 1000000).toFixed(2)}M`;
  if (n >= 1000) return `$${(n / 1000).toFixed(1)}K`;
  return `$${n.toFixed(2)}`;
}

export default function PortfolioPage() {
  const { data: strategy, isLoading } = useStrategy();
  const holdings = strategy?.holdings;
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("all");
  const [sortKey, setSortKey] = useState<SortKey>("backtest_pnl_pct");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("desc"); }
  };

  const filtered = holdings
    ?.filter((h) => sourceFilter === "all" || h.source === sourceFilter)
    .sort((a, b) => {
      let cmp = 0;
      if (sortKey === "ticker") cmp = a.ticker.localeCompare(b.ticker);
      else if (sortKey === "backtest_pnl_pct") cmp = a.backtest_pnl_pct - b.backtest_pnl_pct;
      else if (sortKey === "market_value") cmp = a.market_value - b.market_value;
      else if (sortKey === "backtest_entry_date") cmp = a.backtest_entry_date.localeCompare(b.backtest_entry_date);
      return sortDir === "asc" ? cmp : -cmp;
    });

  const totalValue = holdings?.reduce((sum, h) => sum + h.market_value, 0) ?? 0;

  return (
    <div className="max-w-[1100px] space-y-6">
      <div>
        <h1 className="font-sans text-xl font-bold">Portfolio</h1>
        <p className="font-sans text-[13px] text-text-dim mt-1">
          {strategy
            ? `${strategy.live.position_count} live positions · ${holdings?.length ?? 0} total holdings`
            : "Loading..."}
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "TOTAL VALUE", value: formatCurrency(totalValue) },
          { label: "POSITIONS", value: holdings?.length?.toString() ?? "—" },
          { label: "LIVE", value: strategy?.live.position_count?.toString() ?? "—" },
          { label: "BACKTEST-ONLY", value: holdings?.filter((h) => h.source === "backtest").length.toString() ?? "—" },
        ].map((m) => (
          <div key={m.label} className="bg-bg-secondary border border-border p-4 text-center">
            <span className="font-mono text-[9px] text-text-dim tracking-[1.5px] block mb-1">{m.label}</span>
            <span className="font-mono text-[16px] font-semibold">{isLoading ? "—" : m.value}</span>
          </div>
        ))}
      </div>

      <div className="bg-bg-secondary border border-border overflow-hidden">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between px-5 py-4 border-b border-border gap-3">
          <span className="font-mono text-[10px] text-text-dim tracking-[2px]">
            ALL HOLDINGS ({filtered?.length ?? 0})
          </span>
          <div className="flex items-center gap-2">
            <Filter size={12} className="text-text-dim" />
            {(["all", "live", "backtest"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setSourceFilter(f)}
                className={`font-mono text-[10px] px-3 py-1 tracking-wider transition-colors ${
                  sourceFilter === f
                    ? "bg-bg-tertiary text-text border border-border-light"
                    : "text-text-dim hover:text-text-muted"
                }`}
              >
                {f.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                {([
                  { key: "ticker" as SortKey, label: "TICKER" },
                  { key: null, label: "SOURCE" },
                  { key: "backtest_entry_date" as SortKey, label: "ENTRY DATE" },
                  { key: null, label: "ENTRY PRICE" },
                  { key: null, label: "CURRENT" },
                  { key: "backtest_pnl_pct" as SortKey, label: "BACKTEST P&L" },
                  { key: "market_value" as SortKey, label: "MKT VALUE" },
                ] as const).map((col) => (
                  <th
                    key={col.label}
                    onClick={col.key ? () => toggleSort(col.key) : undefined}
                    className={`font-mono text-left px-5 py-3 text-[10px] text-text-dim tracking-[1.5px] font-medium border-b border-border bg-bg ${
                      col.key ? "cursor-pointer hover:text-text-muted select-none" : ""
                    }`}
                  >
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
                <tr><td colSpan={7} className="px-5 py-8 text-center"><span className="font-mono text-[11px] text-text-dim animate-pulse">LOADING...</span></td></tr>
              ) : !filtered?.length ? (
                <tr><td colSpan={7} className="px-5 py-8 text-center"><span className="font-mono text-[11px] text-text-dim">NO HOLDINGS</span></td></tr>
              ) : (
                filtered.map((h) => (
                  <tr key={`${h.ticker}-${h.source}`} className="border-b border-border last:border-b-0 hover:bg-bg-tertiary/50 transition-colors">
                    <td className="px-5 py-3.5"><span className="font-mono font-semibold text-[14px]">{h.ticker}</span></td>
                    <td className="px-5 py-3.5"><span className={`badge ${h.source === "live" ? "badge-buy" : "badge-hold"}`}>{h.source.toUpperCase()}</span></td>
                    <td className="px-5 py-3.5 font-mono text-[12px] text-text-muted">{h.backtest_entry_date}</td>
                    <td className="px-5 py-3.5 font-mono text-[12px]">{h.entry_price > 0 ? `$${h.entry_price.toFixed(2)}` : "—"}</td>
                    <td className="px-5 py-3.5 font-mono text-[12px]">{h.current_price > 0 ? `$${h.current_price.toFixed(2)}` : "—"}</td>
                    <td className={`px-5 py-3.5 font-mono text-[13px] font-semibold ${h.backtest_pnl_pct >= 0 ? "text-accent-green" : "text-accent-red"}`}>
                      {formatPct(h.backtest_pnl_pct)}
                    </td>
                    <td className="px-5 py-3.5 font-mono text-[12px] text-text-muted">{formatCurrency(h.market_value)}</td>
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
