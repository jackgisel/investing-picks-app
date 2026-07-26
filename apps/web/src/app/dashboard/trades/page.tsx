"use client";

import { useState } from "react";
import Link from "next/link";
import { TRADES_LIMIT, useTrades, type Trade } from "@/lib/hooks/use-trades";
import { useIsAdmin } from "@/components/dashboard/admin-context";
import {
  DataStateRow,
  hasDataState,
  resolveDataState,
} from "@/components/ui/data-state";
import { Filter } from "lucide-react";

type SideFilter = "all" | "buy" | "sell";

/**
 * Colour carries the direction of the decision, not just buy vs sell:
 * green added exposure, red closed a position outright, purple took something
 * off the table while staying in the name. A trim on a doubled winner and a
 * stop-out both used to render as the same red SELL.
 */
const ACTION_META: Record<string, { label: string; badge: string }> = {
  buy: { label: "Buy", badge: "badge-buy" },
  double_buy: { label: "Double buy", badge: "badge-buy" },
  full_sell: { label: "Full sell", badge: "badge-sell" },
  partial_sell: { label: "Partial sell", badge: "badge-hold" },
  trim: { label: "Trim", badge: "badge-hold" },
  recycle_trim: { label: "Recycle trim", badge: "badge-hold" },
  hold: { label: "Hold", badge: "badge-hold" },
};

/** Hand-entered seed trades have no action; fall back to the coarse side. */
function actionMeta(trade: Trade) {
  return (
    (trade.action && ACTION_META[trade.action]) ?? {
      label: trade.side === "buy" ? "Buy" : "Sell",
      badge: trade.side === "buy" ? "badge-buy" : "badge-sell",
    }
  );
}

export default function TradesPage() {
  const {
    data: tradesData,
    isPending,
    isError,
    error,
    refetch,
  } = useTrades();
  const isAdmin = useIsAdmin();
  const trades = tradesData?.trades;
  // The API returns at most TRADES_LIMIT rows and no grand total, so a full
  // page means there are probably more we are not showing.
  const truncated = (trades?.length ?? 0) >= TRADES_LIMIT;
  const [sideFilter, setSideFilter] = useState<SideFilter>("all");
  const [page, setPage] = useState(0);
  const pageSize = 50;

  const filtered = trades?.filter(
    (t) => sideFilter === "all" || t.side === sideFilter
  );

  const totalPages = Math.ceil((filtered?.length ?? 0) / pageSize);
  const paged = filtered?.slice(page * pageSize, (page + 1) * pageSize);

  const buyCount = trades?.filter((t) => t.side === "buy").length ?? 0;
  const sellCount = trades?.filter((t) => t.side === "sell").length ?? 0;

  // `isEmpty` is about the query returning zero rows, not about the client-side
  // filter — a filter that matches nothing gets its own message below, because
  // "you filtered everything out" is not the same as "there are no trades".
  const state = resolveDataState({
    isPending,
    isError,
    error,
    isEmpty: (trades?.length ?? 0) === 0,
  });
  const filteredOut = !state && !paged?.length;

  return (
    <div className="max-w-[1100px] space-y-6">
      <div>
        <h1 className="font-sans text-xl font-bold">Trades</h1>
        <p className="font-sans text-[13px] text-text-dim mt-1">
          {isPending
            ? "Loading..."
            : isError
              ? "Trade history unavailable"
              : `${truncated ? "Most recent " : ""}${trades?.length ?? 0} trades · ${buyCount} buys · ${sellCount} sells`}
        </p>
      </div>

      <div className="soft-card !p-0 overflow-hidden">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between px-5 py-4 border-b border-border gap-3">
          <div className="flex items-center gap-2">
            <Filter size={12} className="text-text-dim" />
            {(["all", "buy", "sell"] as const).map((f) => (
              <button
                key={f}
                onClick={() => {
                  setSideFilter(f);
                  setPage(0);
                }}
                className={`font-sans text-[10px] font-bold tracking-[0.1em] uppercase px-3.5 py-1.5 rounded-pill transition-colors ${
                  sideFilter === f
                    ? "bg-inverse text-inverse-fg"
                    : "text-text-dim hover:text-text bg-bg border border-border"
                }`}
              >
                {f.toUpperCase()}
              </button>
            ))}
          </div>
          <span className="font-mono text-[10px] text-text-dim">
            {isPending || isError ? "—" : `${filtered?.length ?? 0} RESULTS`}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                {[
                  "DATE",
                  "TICKER",
                  "ACTION",
                  "REASON",
                  ...(isAdmin ? ["EVAL"] : []),
                ].map((h) => (
                  <th
                    key={h}
                    className="font-mono text-left px-5 py-3 text-[10px] text-text-dim tracking-[1.5px] font-medium border-b border-border bg-bg rounded-none"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {hasDataState(state) ? (
                <DataStateRow
                  colSpan={isAdmin ? 5 : 4}
                  state={state}
                  error={error}
                  onRetry={() => void refetch()}
                  emptyTitle="No trades yet"
                  emptyMessage="The live book was entered by hand, so there is no trade history behind it. Every buy and sell from here on will be logged on this page."
                />
              ) : filteredOut ? (
                <tr>
                  <td colSpan={isAdmin ? 5 : 4} className="px-5 py-8 text-center">
                    <span className="font-mono text-[11px] text-text-dim">
                      NO TRADES MATCH FILTERS
                    </span>
                  </td>
                </tr>
              ) : (
                paged?.map((t, i) => {
                  const meta = actionMeta(t);
                  return (
                    <tr
                      key={`${t.ticker}-${t.date}-${i}`}
                      className="border-b border-border last:border-b-0 hover:bg-bg-tertiary/50 transition-colors"
                    >
                      <td className="px-5 py-3 font-mono text-[12px] text-text-muted whitespace-nowrap">
                        {t.date.slice(0, 10)}
                      </td>
                      <td className="px-5 py-3">
                        <span className="font-mono font-semibold text-[14px]">
                          {t.ticker}
                        </span>
                      </td>
                      <td className="px-5 py-3 whitespace-nowrap">
                        <span className={`badge ${meta.badge}`}>
                          {meta.label}
                        </span>
                      </td>
                      <td className="px-5 py-3 font-sans text-[12px] text-text-muted max-w-[420px] truncate">
                        {t.reason || "—"}
                      </td>
                      {isAdmin && (
                        <td className="px-5 py-3 font-mono text-[11px] whitespace-nowrap">
                          {t.evaluation_id === null ? (
                            <span className="text-text-dim">—</span>
                          ) : (
                            <Link
                              href={`/dashboard/ops/evaluations/${t.evaluation_id}`}
                              className="text-text underline underline-offset-2 hover:opacity-70"
                            >
                              #{t.evaluation_id}
                            </Link>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-border">
            <button
              onClick={() => setPage(Math.max(0, page - 1))}
              disabled={page === 0}
              className="font-mono text-[10px] px-3 py-1 text-text-dim hover:text-text disabled:opacity-30 disabled:cursor-not-allowed"
            >
              ← PREV
            </button>
            <span className="font-mono text-[10px] text-text-dim">
              PAGE {page + 1} OF {totalPages}
            </span>
            <button
              onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
              disabled={page === totalPages - 1}
              className="font-mono text-[10px] px-3 py-1 text-text-dim hover:text-text disabled:opacity-30 disabled:cursor-not-allowed"
            >
              NEXT →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
