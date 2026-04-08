"use client";

import { useState } from "react";
import { useStrategy } from "@/lib/hooks/use-strategy";
import { ArrowUpDown } from "lucide-react";
import { computePortfolioReturnPct, formatPct } from "@/lib/portfolio";

type SortKey = "ticker" | "pnl_pct" | "entry_date";
type SortDir = "asc" | "desc";

function daysHeld(entryDate: string): string {
  const start = new Date(entryDate).getTime();
  if (Number.isNaN(start)) return "—";
  const days = Math.max(0, Math.floor((Date.now() - start) / (1000 * 60 * 60 * 24)));
  return `${days}d`;
}

export default function PortfolioPage() {
  const { data: strategy, isLoading } = useStrategy();
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
        else if (sortKey === "entry_date")
          cmp = a.entry_date.localeCompare(b.entry_date);
        return sortDir === "asc" ? cmp : -cmp;
      })
    : undefined;

  return (
    <div className="max-w-[1100px] space-y-6">
      <div>
        <h1 className="font-sans text-xl font-bold">Portfolio</h1>
        <p className="font-sans text-[13px] text-text-dim mt-1">
          {portfolio
            ? `${portfolio.position_count} live positions`
            : "Loading..."}
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <SummaryCard
          label="TOTAL RETURN"
          value={hasReturn ? formatPct(totalReturnPct!) : "—"}
          loading={isLoading}
          green={hasReturn && totalReturnPct! >= 0}
          red={hasReturn && totalReturnPct! < 0}
        />
        <SummaryCard
          label="POSITIONS"
          value={portfolio?.position_count.toString() ?? "—"}
          loading={isLoading}
        />
        <SummaryCard
          label="WINNERS"
          value={holdings ? `${winnersCount}` : "—"}
          loading={isLoading}
          green={winnersCount > 0}
        />
        <SummaryCard
          label="LOSERS"
          value={holdings ? `${losersCount}` : "—"}
          loading={isLoading}
          red={losersCount > 0}
        />
      </div>

      {/* Holdings table */}
      <div className="bg-bg-secondary border border-border overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <span className="font-mono text-[10px] text-text-dim tracking-[2px]">
            ALL HOLDINGS ({sorted?.length ?? 0})
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                {(
                  [
                    { key: "ticker" as SortKey, label: "TICKER" },
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
              {isLoading ? (
                <tr>
                  <td colSpan={4} className="px-5 py-8 text-center">
                    <span className="font-mono text-[11px] text-text-dim animate-pulse">
                      LOADING...
                    </span>
                  </td>
                </tr>
              ) : !sorted?.length ? (
                <tr>
                  <td colSpan={4} className="px-5 py-8 text-center">
                    <span className="font-mono text-[11px] text-text-dim">
                      NO HOLDINGS
                    </span>
                  </td>
                </tr>
              ) : (
                sorted.map((h) => (
                  <tr
                    key={h.ticker}
                    className="border-b border-border last:border-b-0 hover:bg-bg-tertiary/50 transition-colors"
                  >
                    <td className="px-5 py-3.5">
                      <span className="font-mono font-semibold text-[14px]">
                        {h.ticker}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 font-mono text-[12px] text-text-muted">
                      {h.entry_date}
                    </td>
                    <td className="px-5 py-3.5 font-mono text-[12px] text-text-muted">
                      {daysHeld(h.entry_date)}
                    </td>
                    <td
                      className={`px-5 py-3.5 font-mono text-[13px] font-semibold ${
                        h.pnl_pct >= 0 ? "text-accent-green" : "text-accent-red"
                      }`}
                    >
                      {formatPct(h.pnl_pct)}
                    </td>
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

function SummaryCard({
  label,
  value,
  loading,
  green = false,
  red = false,
}: {
  label: string;
  value: string;
  loading: boolean;
  green?: boolean;
  red?: boolean;
}) {
  return (
    <div className="bg-bg-secondary border border-border p-4 text-center">
      <span className="font-mono text-[9px] text-text-dim tracking-[1.5px] block mb-1">
        {label}
      </span>
      <span
        className={`font-mono text-[16px] font-semibold ${
          loading
            ? "text-text-dim animate-pulse"
            : red
              ? "text-accent-red"
              : green
                ? "text-accent-green"
                : "text-text"
        }`}
      >
        {loading ? "—" : value}
      </span>
    </div>
  );
}
