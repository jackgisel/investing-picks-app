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
import {
  FilteredOutRow,
  FilterChips,
  PanelHeader,
} from "@/components/dashboard/data-table";
import { HScroll } from "@/components/ui/h-scroll";
import { actionMeta } from "./trade-action";
import { CompanyLogo } from "@/components/ui/company-logo";

type SideFilter = "all" | "buy" | "sell";

const PAGE_SIZE = 50;

export function PositionsActivity() {
  const { data, isPending, isError, error, refetch } = useTrades();
  const isAdmin = useIsAdmin();
  const trades = data?.trades;
  // The API returns at most TRADES_LIMIT rows and no grand total, so a full
  // page means there are probably more we are not showing.
  const truncated = (trades?.length ?? 0) >= TRADES_LIMIT;

  const [sideFilter, setSideFilter] = useState<SideFilter>("all");
  const [page, setPage] = useState(0);

  const filtered = trades?.filter(
    (t) => sideFilter === "all" || t.side === sideFilter,
  );
  const totalPages = Math.ceil((filtered?.length ?? 0) / PAGE_SIZE);
  const paged = filtered?.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const state = resolveDataState({
    isPending,
    isError,
    error,
    isEmpty: (trades?.length ?? 0) === 0,
  });
  const filteredOut = !state && !paged?.length;
  const colSpan = isAdmin ? 5 : 4;

  return (
    <div className="pt-4">
      <div className="data-panel">
        <PanelHeader label="Trade activity" tone="mint">
          <div className="flex flex-wrap items-center gap-3">
            <FilterChips
              options={["all", "buy", "sell"] as const}
              value={sideFilter}
              onChange={(f) => {
                setSideFilter(f);
                setPage(0);
              }}
              label="Filter trades by side"
            />
            <span className="font-mono text-[10px] text-text-dim">
              {isPending || isError
                ? "—"
                : `${truncated ? "LAST " : ""}${filtered?.length ?? 0} TRADES`}
            </span>
          </div>
        </PanelHeader>

        <HScroll>
          <table className="w-full">
            <thead>
              <tr>
                {[
                  "DATE",
                  "TICKER",
                  "ACTION",
                  "REASON",
                  ...(isAdmin ? ["EVAL"] : []),
                ].map((h, index) => (
                  <th
                    key={h}
                    scope="col"
                    className={`border-b border-border bg-bg px-3 py-3 text-left font-mono text-[10px] font-medium tracking-[1.5px] text-text-dim sm:px-5${
                      index === 0 ? " sticky-col" : ""
                    }`}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {hasDataState(state) ? (
                <DataStateRow
                  colSpan={colSpan}
                  state={state}
                  error={error}
                  onRetry={() => void refetch()}
                  emptyTitle="No trades yet"
                  emptyMessage="The live book was entered by hand, so there is no trade history behind it. Every buy and sell from here on will be logged here."
                />
              ) : filteredOut ? (
                <FilteredOutRow colSpan={colSpan} />
              ) : (
                paged?.map((t, i) => {
                  const meta = actionMeta(t);
                  return (
                    <tr
                      key={`${t.ticker}-${t.date}-${i}`}
                      className="group border-b border-border transition-colors last:border-b-0 hover:bg-bg-tertiary/50"
                    >
                      <td className="sticky-col whitespace-nowrap px-3 py-3 font-mono text-[12px] text-text-muted group-hover:bg-bg-tertiary sm:px-5">
                        {t.date.slice(0, 10)}
                      </td>
                      <td className="px-3 py-3 sm:px-5">
                        <span className="flex items-center gap-2.5 font-mono text-[14px] font-semibold">
                          <CompanyLogo ticker={t.ticker} size="xs" />
                          <span>{t.ticker}</span>
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 sm:px-5">
                        <span className={`badge ${meta.badge}`}>
                          {meta.label}
                        </span>
                      </td>
                      <td className="max-w-[420px] truncate px-3 py-3 font-sans text-[12px] text-text-muted sm:px-5">
                        {t.reason || "—"}
                      </td>
                      {isAdmin && (
                        <td className="whitespace-nowrap px-3 py-3 font-mono text-[11px] sm:px-5">
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
        </HScroll>

        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-border px-5 py-3">
            <button
              type="button"
              onClick={() => setPage(Math.max(0, page - 1))}
              disabled={page === 0}
              className="px-3 py-1 font-mono text-[10px] text-text-dim hover:text-text disabled:cursor-not-allowed disabled:opacity-30"
            >
              ← PREV
            </button>
            <span className="font-mono text-[10px] text-text-dim">
              PAGE {page + 1} OF {totalPages}
            </span>
            <button
              type="button"
              onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
              disabled={page === totalPages - 1}
              className="px-3 py-1 font-mono text-[10px] text-text-dim hover:text-text disabled:cursor-not-allowed disabled:opacity-30"
            >
              NEXT →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
