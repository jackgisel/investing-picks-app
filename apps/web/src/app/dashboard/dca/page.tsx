"use client";

import { Banknote, Layers, Scale, TrendingUp } from "lucide-react";
import { CompanyLogo } from "@/components/ui/company-logo";
import {
  DataStateCard,
  hasDataState,
  resolveDataState,
} from "@/components/ui/data-state";
import { DcaWealthChart } from "@/components/dashboard/dca-wealth-chart";
import { StatTile } from "@/components/dashboard/stat-tile";
import { useDcaHoldings, useDcaPerformance, type DcaHolding } from "@/lib/hooks/use-dca";
import {
  formatDayMonth,
  formatPctOrDash,
  formatUsd,
  pnlClass,
} from "@/lib/portfolio";

function signalBadgeClass(signal: string): string {
  if (signal === "strong_buy" || signal === "buy") return "badge-buy";
  if (signal === "hold") return "badge-hold";
  return "badge-sell";
}

export default function DcaPage() {
  const perfQuery = useDcaPerformance();
  const holdQuery = useDcaHoldings();
  const perf = perfQuery.data;
  const holdings = holdQuery.data;

  const state = resolveDataState({
    isPending: perfQuery.isPending,
    isError: perfQuery.isError,
    error: perfQuery.error,
    isEmpty: false,
  });

  const delta = perf?.delta?.dollars ?? null;
  const deltaPct = perf?.delta?.pct_of_contributed ?? null;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="page-title">Weekly $1,000</h1>
        <p className="mt-1 max-w-[640px] font-sans text-[13px] leading-relaxed text-text-dim">
          A sample, not the live book. Both portfolios receive $1,000 every
          Friday. One buys VOO and holds it. The other splits that cash across
          the live book&apos;s open positions that are still rated BUY or
          STRONG BUY that day, and still sells on the live book&apos;s exit
          rules. The live product remains one pick every two weeks.
        </p>
      </div>

      {hasDataState(state) ? (
        <DataStateCard
          state={state}
          error={perfQuery.error}
          onRetry={() => void perfQuery.refetch()}
          emptyTitle="No deposits yet"
          emptyMessage="The sample starts on the first Friday after the live book's inception."
        />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatTile
              label="DEPOSITED"
              value={formatUsd(perf?.contributed ?? 0)}
              icon={Banknote}
              tone="cyan"
              loading={perfQuery.isPending}
            />
            <StatTile
              label="OPEN BUYS"
              value={formatUsd(perf?.picks?.value ?? null)}
              icon={TrendingUp}
              tone="mint"
              valueTone={
                (perf?.picks?.return_on_contributed_pct ?? 0) >= 0 ? "green" : "red"
              }
              loading={perfQuery.isPending}
            />
            <StatTile
              label="VOO"
              value={formatUsd(perf?.voo?.value ?? null)}
              icon={Layers}
              tone="cyan"
              loading={perfQuery.isPending}
            />
            <StatTile
              label="OPEN BUYS − VOO"
              value={
                delta == null
                  ? "—"
                  : `${delta >= 0 ? "+" : ""}${formatUsd(delta)}${
                      deltaPct == null ? "" : ` (${formatPctOrDash(deltaPct)})`
                    }`
              }
              icon={Scale}
              tone="lilac"
              valueTone={
                delta == null ? "neutral" : delta >= 0 ? "green" : "red"
              }
              loading={perfQuery.isPending}
            />
          </div>

          <DcaWealthChart series={perf?.series ?? []} />

          <section className="space-y-3">
            <p className="panel-label panel-label-mint">Open buy holdings</p>
            <HoldingsTable
              rows={holdings?.picks ?? []}
              loading={holdQuery.isPending}
              ratingAsOf={holdings?.rating_as_of ?? null}
            />
          </section>
        </>
      )}
    </div>
  );
}

function HoldingsTable({
  rows,
  loading,
  ratingAsOf,
}: {
  rows: DcaHolding[];
  loading: boolean;
  ratingAsOf: string | null;
}) {
  if (loading) {
    return <div className="data-card h-40 animate-pulse bg-bg-tertiary" />;
  }
  if (rows.length === 0) {
    return (
      <div className="data-card px-5 py-8 text-center font-sans text-[13px] text-text-muted">
        No open names yet. They appear after a Friday when the live book holds a BUY.
      </div>
    );
  }
  return (
    <div className="data-panel overflow-x-auto">
      <table className="w-full text-left">
        <thead>
          <tr className="border-b border-border">
            <th className="field-label px-4 py-2.5">Ticker</th>
            <th className="field-label px-4 py-2.5">Sector</th>
            <th className="field-label px-4 py-2.5 text-right">Weight</th>
            <th className="field-label px-4 py-2.5">
              Rating
              {ratingAsOf ? (
                <span className="ml-1 font-sans font-normal text-text-dim">
                  {formatDayMonth(ratingAsOf)}
                </span>
              ) : null}
            </th>
            <th className="field-label px-4 py-2.5 text-right">Return</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.ticker} className="border-b border-border last:border-0">
              <td className="px-4 py-2.5">
                <span className="inline-flex items-center gap-2">
                  <CompanyLogo ticker={row.ticker} size="xs" />
                  <span className="font-mono text-[13px] font-semibold">
                    {row.ticker}
                  </span>
                </span>
              </td>
              <td className="px-4 py-2.5 font-sans text-[13px] text-text-muted">
                {row.sector ?? "—"}
              </td>
              <td className="px-4 py-2.5 text-right font-mono text-[13px] tabular-nums">
                {row.weight_pct.toFixed(1)}%
              </td>
              <td className="px-4 py-2.5">
                {row.signal ? (
                  <span className={`badge ${signalBadgeClass(row.signal)}`}>
                    {row.signal.replace("_", " ")}
                  </span>
                ) : (
                  <span className="text-text-dim">—</span>
                )}
              </td>
              <td
                className={`px-4 py-2.5 text-right font-mono text-[13px] tabular-nums ${pnlClass(row.pnl_pct)}`}
              >
                {formatPctOrDash(row.pnl_pct)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
