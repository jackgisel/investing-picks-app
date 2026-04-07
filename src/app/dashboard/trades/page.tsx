"use client";

import { useState } from "react";
import { useTrades } from "@/lib/hooks/use-trades";
import { Filter } from "lucide-react";

type SourceFilter = "all" | "backtest" | "live";
type SideFilter = "all" | "buy" | "sell";

export default function TradesPage() {
  const { data: tradesData, isLoading } = useTrades();
  const trades = tradesData?.trades;
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("all");
  const [sideFilter, setSideFilter] = useState<SideFilter>("all");
  const [page, setPage] = useState(0);
  const pageSize = 50;

  const filtered = trades
    ?.filter((t) => sourceFilter === "all" || t.source === sourceFilter)
    .filter((t) => sideFilter === "all" || t.side === sideFilter);

  const totalPages = Math.ceil((filtered?.length ?? 0) / pageSize);
  const paged = filtered?.slice(page * pageSize, (page + 1) * pageSize);

  const buyCount = trades?.filter((t) => t.side === "buy").length ?? 0;
  const sellCount = trades?.filter((t) => t.side === "sell").length ?? 0;

  return (
    <div className="max-w-[1100px] space-y-6">
      <div>
        <h1 className="font-sans text-xl font-bold">Trades</h1>
        <p className="font-sans text-[13px] text-text-dim mt-1">
          {isLoading ? "Loading..." : `${trades?.length ?? 0} total trades · ${buyCount} buys · ${sellCount} sells`}
        </p>
      </div>

      <div className="bg-bg-secondary border border-border overflow-hidden">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between px-5 py-4 border-b border-border gap-3">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Filter size={12} className="text-text-dim" />
              {(["all", "buy", "sell"] as const).map((f) => (
                <button key={f} onClick={() => { setSideFilter(f); setPage(0); }}
                  className={`font-mono text-[10px] px-3 py-1 tracking-wider transition-colors ${sideFilter === f ? "bg-bg-tertiary text-text border border-border-light" : "text-text-dim hover:text-text-muted"}`}>
                  {f.toUpperCase()}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              {(["all", "backtest", "live"] as const).map((f) => (
                <button key={f} onClick={() => { setSourceFilter(f); setPage(0); }}
                  className={`font-mono text-[10px] px-3 py-1 tracking-wider transition-colors ${sourceFilter === f ? "bg-bg-tertiary text-text border border-border-light" : "text-text-dim hover:text-text-muted"}`}>
                  {f.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
          <span className="font-mono text-[10px] text-text-dim">{filtered?.length ?? 0} RESULTS</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                {["DATE", "TICKER", "SIDE", "SOURCE", "PRICE", "SHARES", "REASON", "PORT. VALUE"].map((h) => (
                  <th key={h} className="font-mono text-left px-5 py-3 text-[10px] text-text-dim tracking-[1.5px] font-medium border-b border-border bg-bg">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={8} className="px-5 py-8 text-center"><span className="font-mono text-[11px] text-text-dim animate-pulse">LOADING...</span></td></tr>
              ) : !paged?.length ? (
                <tr><td colSpan={8} className="px-5 py-8 text-center"><span className="font-mono text-[11px] text-text-dim">NO TRADES MATCH FILTERS</span></td></tr>
              ) : (
                paged.map((t, i) => (
                  <tr key={`${t.ticker}-${t.date}-${i}`} className="border-b border-border last:border-b-0 hover:bg-bg-tertiary/50 transition-colors">
                    <td className="px-5 py-3 font-mono text-[12px] text-text-muted whitespace-nowrap">{t.date.slice(0, 10)}</td>
                    <td className="px-5 py-3"><span className="font-mono font-semibold text-[14px]">{t.ticker}</span></td>
                    <td className="px-5 py-3"><span className={`badge ${t.side === "buy" ? "badge-buy" : "badge-sell"}`}>{t.side.toUpperCase()}</span></td>
                    <td className="px-5 py-3 font-mono text-[11px] text-text-dim">{t.source.toUpperCase()}</td>
                    <td className="px-5 py-3 font-mono text-[12px]">{t.price > 0 ? `$${t.price.toFixed(2)}` : "—"}</td>
                    <td className="px-5 py-3 font-mono text-[12px] text-text-muted">{t.shares > 0 ? t.shares.toFixed(2) : "—"}</td>
                    <td className="px-5 py-3 font-sans text-[12px] text-text-muted max-w-[250px] truncate">{t.reason || "—"}</td>
                    <td className="px-5 py-3 font-mono text-[12px] text-text-muted">{t.portfolio_value ? `$${(t.portfolio_value / 1000).toFixed(0)}K` : "—"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-border">
            <button onClick={() => setPage(Math.max(0, page - 1))} disabled={page === 0}
              className="font-mono text-[10px] px-3 py-1 text-text-dim hover:text-text disabled:opacity-30 disabled:cursor-not-allowed">
              ← PREV
            </button>
            <span className="font-mono text-[10px] text-text-dim">PAGE {page + 1} OF {totalPages}</span>
            <button onClick={() => setPage(Math.min(totalPages - 1, page + 1))} disabled={page === totalPages - 1}
              className="font-mono text-[10px] px-3 py-1 text-text-dim hover:text-text disabled:opacity-30 disabled:cursor-not-allowed">
              NEXT →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
