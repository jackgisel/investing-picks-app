"use client";

import { useState } from "react";
import Link from "next/link";
import { FileText } from "lucide-react";
import { usePicks } from "@/lib/hooks/use-picks";
import {
  DataStateRow,
  hasDataState,
  resolveDataState,
} from "@/components/ui/data-state";
import {
  PanelHeader,
  SortableHead,
  type Column,
  type SortDir,
} from "@/components/dashboard/data-table";
import { HScroll } from "@/components/ui/h-scroll";
import { formatPctOrDash, pnlClass } from "@/lib/portfolio";
import { insightForTicker } from "@/lib/insights";
import { useInsights } from "@/lib/hooks/use-insights";
import { CompanyLogo } from "@/components/ui/company-logo";

type SortKey = "ticker" | "entry_date" | "exit_date" | "pnl_pct";

const COLUMNS: readonly Column<SortKey>[] = [
  { label: "TICKER", sortKey: "ticker" },
  { label: "ENTRY DATE", sortKey: "entry_date" },
  { label: "EXIT DATE", sortKey: "exit_date" },
  { label: "HELD" },
  { label: "RETURN", sortKey: "pnl_pct" },
  { label: "EXIT REASON" },
];

function heldFor(entry: string | null, exit: string | null): string {
  if (!entry || !exit) return "—";
  const a = new Date(entry).getTime();
  const b = new Date(exit).getTime();
  if (Number.isNaN(a) || Number.isNaN(b)) return "—";
  return `${Math.max(0, Math.floor((b - a) / 86400000))}d`;
}

export function PositionsClosed() {
  const query = usePicks("closed");
  const insights = useInsights().data?.insights ?? [];
  const { data, isPending, isError, error } = query;
  const picks = data?.picks;

  const [sortKey, setSortKey] = useState<SortKey>("exit_date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else {
      setSortKey(key);
      setSortDir("desc");
    }
  };

  const sorted = picks
    ? [...picks].sort((a, b) => {
        let cmp = 0;
        if (sortKey === "ticker") cmp = a.ticker.localeCompare(b.ticker);
        else if (sortKey === "pnl_pct")
          cmp = (a.pnl_pct ?? 0) - (b.pnl_pct ?? 0);
        else if (sortKey === "entry_date")
          cmp = a.entry_date.localeCompare(b.entry_date);
        else if (sortKey === "exit_date")
          cmp = (a.exit_date ?? "").localeCompare(b.exit_date ?? "");
        return sortDir === "asc" ? cmp : -cmp;
      })
    : undefined;

  const state = resolveDataState({
    isPending,
    isError,
    error,
    isEmpty: (picks?.length ?? 0) === 0,
  });

  return (
    <div className="pt-4">
      <div className="data-panel">
        <PanelHeader label="Closed picks" tone="mint">
          <span className="font-mono text-[10px] text-text-dim">
            {isPending || isError ? "—" : `${sorted?.length ?? 0} CLOSED`}
          </span>
        </PanelHeader>

        <HScroll>
          <table className="w-full">
            <SortableHead
              columns={COLUMNS}
              sortKey={sortKey}
              sortDir={sortDir}
              onSort={toggleSort}
              stickyFirst
            />
            <tbody>
              {hasDataState(state) ? (
                <DataStateRow
                  colSpan={COLUMNS.length}
                  state={state}
                  error={error}
                  onRetry={() => void query.refetch()}
                  emptyTitle="Nothing closed yet"
                  emptyMessage="Every pick opened so far is still open. Exits show up here with the reason the strategy gave for them."
                />
              ) : (
                sorted?.map((p, i) => {
                  const slug =
                    p.blog_slug ?? insightForTicker(insights, p.ticker)?.slug;
                  return (
                    <tr
                      key={`${p.ticker}-${p.entry_date}-${i}`}
                      className="group border-b border-border transition-colors last:border-b-0 hover:bg-bg-tertiary/50"
                    >
                      <td className="sticky-col px-3 py-3.5 group-hover:bg-bg-tertiary sm:px-5">
                        <span className="flex items-center gap-2.5">
                          <CompanyLogo ticker={p.ticker} size="sm" />
                          {slug ? (
                            <Link
                              href={`/dashboard/insights/${slug}`}
                              title="Read the research note"
                              className="inline-flex items-center gap-1.5 font-mono text-[14px] font-semibold text-text underline underline-offset-4 hover:opacity-70"
                            >
                              {p.ticker}
                              <FileText size={11} className="text-accent-lilac" />
                            </Link>
                          ) : (
                            <span className="font-mono text-[14px] font-semibold">
                              {p.ticker}
                            </span>
                          )}
                        </span>
                      </td>
                      <td className="px-3 py-3.5 font-mono text-[12px] text-text-muted sm:px-5">
                        {p.entry_date}
                      </td>
                      <td className="px-3 py-3.5 font-mono text-[12px] text-text-muted sm:px-5">
                        {p.exit_date ?? "—"}
                      </td>
                      <td className="px-3 py-3.5 font-mono text-[12px] tabular-nums text-text-muted sm:px-5">
                        {heldFor(p.entry_date, p.exit_date)}
                      </td>
                      <td
                        className={`px-3 py-3.5 font-mono text-[13px] font-semibold tabular-nums sm:px-5 ${pnlClass(
                          p.pnl_pct,
                        )}`}
                      >
                        {formatPctOrDash(p.pnl_pct)}
                      </td>
                      <td className="max-w-[260px] truncate px-3 py-3.5 font-sans text-[11px] text-text-dim sm:px-5">
                        {p.exit_reason || "—"}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </HScroll>
      </div>
    </div>
  );
}
