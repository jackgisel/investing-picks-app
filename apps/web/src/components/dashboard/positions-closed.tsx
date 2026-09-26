"use client";

import { useState } from "react";
import { ChevronRight } from "lucide-react";
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
import { comparePnl, formatPctOrDash, pnlClass } from "@/lib/portfolio";
import { CompanyLogo } from "@/components/ui/company-logo";

type SortKey = "ticker" | "entry_date" | "exit_date" | "pnl_pct";

// Result next to the name, as on the open list; the reason gets the width.
const COLUMNS: readonly Column<SortKey>[] = [
  { label: "POSITION", sortKey: "ticker" },
  { label: "RETURN", sortKey: "pnl_pct" },
  { label: "HELD" },
  { label: "ENTRY", sortKey: "entry_date" },
  { label: "EXIT", sortKey: "exit_date" },
  { label: "WHY IT CLOSED" },
  { label: "" },
];

function heldFor(entry: string | null, exit: string | null): string {
  if (!entry || !exit) return "—";
  const a = new Date(entry).getTime();
  const b = new Date(exit).getTime();
  if (Number.isNaN(a) || Number.isNaN(b)) return "—";
  return `${Math.max(0, Math.floor((b - a) / 86400000))}d`;
}

export function PositionsClosed({
  onSelect,
}: {
  onSelect: (ticker: string) => void;
}) {
  const query = usePicks("closed");
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
        // An unknown result is not a 0% result. `?? 0` was filing it between
        // the small winners and the small losers; comparePnl keeps unknowns
        // at the bottom whichever way the column is flipped.
        if (sortKey === "pnl_pct")
          return comparePnl(a.pnl_pct, b.pnl_pct, sortDir);
        let cmp = 0;
        if (sortKey === "ticker") cmp = a.ticker.localeCompare(b.ticker);
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
    <div>
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
                sorted?.map((p, i) => (
                  <tr
                    key={`${p.ticker}-${p.entry_date}-${i}`}
                    onClick={() => onSelect(p.ticker)}
                    className="group cursor-pointer border-b border-border transition-colors duration-100 last:border-b-0 hover:bg-bg-tertiary/50"
                  >
                    <td className="sticky-col px-3 py-3 group-hover:bg-bg-tertiary sm:px-5">
                      <span className="flex items-center gap-2.5">
                        <CompanyLogo ticker={p.ticker} size="sm" />
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelect(p.ticker);
                          }}
                          className="font-mono text-[14px] font-semibold text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
                        >
                          {p.ticker}
                        </button>
                      </span>
                    </td>
                    <td
                      className={`whitespace-nowrap px-3 py-3 font-mono text-[14px] font-semibold tabular-nums sm:px-5 ${pnlClass(
                        p.pnl_pct,
                      )}`}
                    >
                      {formatPctOrDash(p.pnl_pct, 1)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 font-mono text-[12px] tabular-nums text-text-muted sm:px-5">
                      {heldFor(p.entry_date, p.exit_date)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 font-mono text-[12px] text-text-muted sm:px-5">
                      {p.entry_date}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 font-mono text-[12px] text-text-muted sm:px-5">
                      {p.exit_date ?? "—"}
                    </td>
                    <td className="min-w-[240px] px-3 py-3 font-sans text-[12px] leading-snug text-text-muted sm:px-5">
                      {p.exit_reason || "—"}
                    </td>
                    <td className="px-2 py-3 text-text-dim">
                      <ChevronRight
                        size={14}
                        className="transition-transform group-hover:translate-x-0.5"
                        aria-hidden
                      />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </HScroll>
      </div>
    </div>
  );
}
