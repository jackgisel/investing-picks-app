"use client";

import Link from "next/link";
import { Fragment, useState } from "react";
import { ChevronDown, Lock } from "lucide-react";
import { HScroll } from "@/components/ui/h-scroll";
import { formatCompactUsd } from "@/lib/market-cap";
import { cn } from "@/lib/utils";
import {
  formatEmployees,
  formatGrowth,
  formatLeverage,
  formatPerEmployee,
  shapeLabel,
  type WorkforceHistory,
  type WorkforceRow,
} from "@/lib/workforce";
import { HistoryChart } from "./history-chart";

type Panel =
  | { state: "loading" }
  | { state: "error" }
  | { state: "ready"; history: WorkforceHistory };

function growthTone(value: number | null) {
  if (typeof value !== "number") return "text-text-dim";
  return value >= 0 ? "text-text" : "text-text-muted";
}

export function WorkforceTable({
  rows,
  entitled,
}: {
  rows: WorkforceRow[];
  entitled: boolean;
}) {
  const [open, setOpen] = useState<string | null>(null);
  const [panels, setPanels] = useState<Record<string, Panel>>({});

  async function toggle(ticker: string) {
    if (open === ticker) {
      setOpen(null);
      return;
    }
    setOpen(ticker);
    if (!entitled || panels[ticker]?.state === "ready") return;
    setPanels((p) => ({ ...p, [ticker]: { state: "loading" } }));
    try {
      const res = await fetch(`/api/data/workforce/${encodeURIComponent(ticker)}`);
      if (!res.ok) throw new Error(String(res.status));
      const history = (await res.json()) as WorkforceHistory;
      setPanels((p) => ({ ...p, [ticker]: { state: "ready", history } }));
    } catch {
      setPanels((p) => ({ ...p, [ticker]: { state: "error" } }));
    }
  }

  const th =
    "py-3 px-3 font-sans text-[11px] font-bold uppercase tracking-[0.12em] text-text-dim whitespace-nowrap";

  return (
    <HScroll>
      <table className="w-full min-w-[920px] border-collapse">
        <thead>
          <tr className="border-b border-border-strong text-left">
            <th className={cn(th, "w-12")}>#</th>
            <th className={th}>Company</th>
            <th className={cn(th, "text-right")}>Revenue / employee</th>
            <th className={cn(th, "text-right")}>Employees</th>
            <th className={cn(th, "text-right")}>Revenue</th>
            <th className={cn(th, "text-right")}>Staff YoY</th>
            <th className={cn(th, "text-right")}>Revenue YoY</th>
            <th className={cn(th, "text-right")}>Leverage</th>
            <th className={th}>Shape</th>
            <th className={cn(th, "w-12")}>
              <span className="sr-only">History</span>
            </th>
          </tr>
        </thead>
        <tbody className="font-mono text-[13px]">
          {rows.map((r) => {
            const isOpen = open === r.ticker;
            const panel = panels[r.ticker];
            return (
              <Fragment key={r.ticker}>
                <tr className="border-b border-border/70">
                  <td className="py-3 px-3 text-text-dim">{r.rank}</td>
                  <td className="py-3 px-3">
                    <div className="font-semibold text-text">{r.ticker}</div>
                    <div className="max-w-[240px] truncate font-sans text-[12px] text-text-muted">
                      {r.name ?? r.industry ?? ""}
                    </div>
                  </td>
                  <td className="py-3 px-3 text-right font-semibold text-text">
                    {formatPerEmployee(r.rev_per_employee)}
                  </td>
                  <td className="py-3 px-3 text-right">{formatEmployees(r.employees)}</td>
                  <td className="py-3 px-3 text-right">{formatCompactUsd(r.revenue)}</td>
                  <td className={cn("py-3 px-3 text-right", growthTone(r.employees_yoy))}>
                    {formatGrowth(r.employees_yoy)}
                  </td>
                  <td className={cn("py-3 px-3 text-right", growthTone(r.revenue_yoy))}>
                    {formatGrowth(r.revenue_yoy)}
                  </td>
                  <td className={cn("py-3 px-3 text-right", growthTone(r.leverage))}>
                    {formatLeverage(r.leverage)}
                  </td>
                  <td className="py-3 px-3 font-sans text-[12px] text-text-muted whitespace-nowrap">
                    {shapeLabel(r.shape)}
                  </td>
                  <td className="py-3 px-3 text-right">
                    <button
                      type="button"
                      onClick={() => toggle(r.ticker)}
                      aria-expanded={isOpen}
                      aria-label={`${isOpen ? "Hide" : "Show"} ${r.ticker} history`}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-full text-text-muted transition-colors hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text"
                    >
                      {entitled ? (
                        <ChevronDown className={cn("h-4 w-4 transition-transform", isOpen && "rotate-180")} />
                      ) : (
                        <Lock className="h-3.5 w-3.5" />
                      )}
                    </button>
                  </td>
                </tr>
                {isOpen && (
                  <tr className="border-b border-border/70 bg-bg-secondary">
                    <td colSpan={10} className="px-4 py-5 sm:px-6">
                      {!entitled ? (
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <p className="max-w-[520px] font-sans text-[14px] text-text-muted">
                            Year by year headcount and revenue, with the chart, is for members.
                          </p>
                          <Link href="/subscribe" className="btn-outline">
                            See membership
                          </Link>
                        </div>
                      ) : panel?.state === "ready" ? (
                        <HistoryChart history={panel.history} />
                      ) : panel?.state === "error" ? (
                        <p className="font-sans text-[13px] text-text-muted">
                          Could not load the history. Try again in a moment.
                        </p>
                      ) : (
                        <p className="font-sans text-[13px] text-text-muted">Loading</p>
                      )}
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </HScroll>
  );
}
