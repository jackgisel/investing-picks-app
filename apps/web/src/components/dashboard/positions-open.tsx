"use client";

import { useState } from "react";
import Link from "next/link";
import { FileText } from "lucide-react";
import { useStrategy } from "@/lib/hooks/use-strategy";
import { usePicks } from "@/lib/hooks/use-picks";
import {
  DataStateRow,
  hasDataState,
  resolveDataState,
} from "@/components/ui/data-state";
import { SectorAllocation } from "@/components/dashboard/sector-allocation";
import { asShareOfInvested } from "@/components/dashboard/sector-model";
import {
  PanelHeader,
  SortableHead,
  type Column,
  type SortDir,
} from "@/components/dashboard/data-table";
import { HScroll } from "@/components/ui/h-scroll";
import {
  calendarDaysHeld,
  comparePnl,
  formatDayMonth,
  formatPctOrDash,
  pnlClass,
} from "@/lib/portfolio";
import { describeOpenRating } from "@/components/dashboard/open-rating";
import { insightForTicker } from "@/lib/insights";
import { useInsights } from "@/lib/hooks/use-insights";
import { CompanyLogo } from "@/components/ui/company-logo";
import { formatCompactUsd, marketCapTier } from "@/lib/market-cap";

type SortKey =
  | "ticker"
  | "sector"
  | "market_cap"
  | "weight_pct"
  | "entry_date"
  | "pnl_pct";

/**
 * `ratingNote` stamps the RATING column with the date those ratings were
 * struck. The universe is scored on a schedule, not on page load, so a badge
 * with no date on it reads as the strategy's view *today* however old it is —
 * which is the reading that matters least when someone is deciding whether to
 * add to a position.
 */
function buildColumns(ratingNote: string | null): readonly Column<SortKey>[] {
  return [
    { label: "TICKER", sortKey: "ticker" },
    { label: "SECTOR", sortKey: "sector" },
    { label: "MARKET CAP", sortKey: "market_cap" },
    // Share of INVESTED capital (see asShareOfInvested). The sector card
    // above the table already used these weights; the table never showed
    // them per name, so "SEZL is a fifth of what we own" was not readable
    // anywhere a subscriber looks at SEZL.
    { label: "WEIGHT", sortKey: "weight_pct", note: "of invested" },
    { label: "RATING", note: ratingNote ?? undefined },
    { label: "ENTRY DATE", sortKey: "entry_date" },
    { label: "DAYS HELD" },
    { label: "RETURN", sortKey: "pnl_pct" },
  ];
}

export function PositionsOpen() {
  const strategyQuery = useStrategy();
  const picksQuery = usePicks("active");
  // Note links resolve a beat after the table paints now that the metadata is
  // fetched rather than bundled. Defaulting to [] keeps the row rendering
  // instead of waiting on it.
  const insights = useInsights().data?.insights ?? [];
  const { data: strategy, isPending, isError, error } = strategyQuery;
  const holdings = strategy?.holdings
    ? asShareOfInvested(strategy.holdings)
    : undefined;

  const [sortKey, setSortKey] = useState<SortKey>("pnl_pct");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else {
      setSortKey(key);
      setSortDir("desc");
    }
  };

  // The strategy endpoint knows sector and market cap; the picks endpoint knows
  // the current rating. Joining them here is what let Portfolio and Pick history be
  // one table instead of two pages showing the same rows.
  const signalByTicker = new Map(
    (picksQuery.data?.picks ?? []).map((p) => [p.ticker, p.signal]),
  );

  const ratingAsOf = picksQuery.data?.rating_as_of ?? null;
  const ratingDate = formatDayMonth(ratingAsOf);
  const columns = buildColumns(ratingDate && `as of ${ratingDate}`);
  const minHoldingDays =
    typeof strategy?.params?.min_holding_days === "number"
      ? strategy.params.min_holding_days
      : null;

  const sorted = holdings
    ? [...holdings].sort((a, b) => {
        // Unknowns sort last regardless of direction, so the flip below must
        // not touch them.
        if (sortKey === "pnl_pct")
          return comparePnl(a.pnl_pct, b.pnl_pct, sortDir);
        if (sortKey === "weight_pct")
          return comparePnl(a.weight_pct, b.weight_pct, sortDir);
        let cmp = 0;
        if (sortKey === "ticker")
          cmp = (a.ticker ?? "").localeCompare(b.ticker ?? "");
        else if (sortKey === "market_cap")
          cmp = (a.market_cap ?? 0) - (b.market_cap ?? 0);
        else if (sortKey === "sector")
          cmp = (a.sector ?? "").localeCompare(b.sector ?? "");
        else if (sortKey === "entry_date")
          cmp = (a.entry_date ?? "").localeCompare(b.entry_date ?? "");
        return sortDir === "asc" ? cmp : -cmp;
      })
    : undefined;

  const state = resolveDataState({
    isPending,
    isError,
    error,
    isEmpty: (holdings?.length ?? 0) === 0,
  });

  return (
    <div className="space-y-4 pt-4">
      {holdings && holdings.length > 0 && (
        <SectorAllocation
          holdings={holdings}
          sectorCap={
            typeof strategy?.params?.sector_concentration === "number"
              ? strategy.params.sector_concentration
              : null
          }
          maxPositions={strategy?.strategy?.max_positions ?? null}
        />
      )}

      <div className="data-panel">
        <PanelHeader label="Open positions" tone="mint">
          <span className="font-mono text-[10px] text-text-dim">
            {isPending || isError ? "—" : `${sorted?.length ?? 0} HOLDINGS`}
          </span>
        </PanelHeader>

        <HScroll>
          <table className="w-full">
            <SortableHead
              columns={columns}
              sortKey={sortKey}
              sortDir={sortDir}
              onSort={toggleSort}
              stickyFirst
            />
            <tbody>
              {hasDataState(state) ? (
                <DataStateRow
                  colSpan={columns.length}
                  state={state}
                  error={error}
                  onRetry={() => void strategyQuery.refetch()}
                  emptyTitle="No open positions"
                  emptyMessage="The book has no open positions right now. New positions appear here as soon as they are opened."
                />
              ) : (
                sorted?.map((h, index) => {
                  const slug = insightForTicker(insights, h.ticker)?.slug;
                  const signal = h.ticker
                    ? signalByTicker.get(h.ticker)
                    : undefined;
                  const rating = describeOpenRating({
                    signal,
                    entryDate: h.entry_date,
                    minHoldingDays,
                    ratingAsOf: ratingDate,
                  });
                  const held = calendarDaysHeld(h.entry_date);
                  const tier = marketCapTier(h.market_cap);
                  return (
                    <tr
                      key={
                        h.ticker ??
                        h.entry_date ??
                        `anonymous-holding-${index}`
                      }
                      className="group border-b border-border transition-colors duration-100 last:border-b-0 hover:bg-bg-tertiary/50"
                    >
                      <td className="sticky-col px-3 py-3.5 group-hover:bg-bg-tertiary sm:px-5">
                        <span className="flex items-center gap-2.5">
                          <CompanyLogo ticker={h.ticker} size="sm" />
                          <span className="flex items-center gap-2">
                            {slug ? (
                              <Link
                                href={`/dashboard/insights/${slug}`}
                                title="Read the research note"
                                className="inline-flex items-center gap-1.5 font-mono text-[14px] font-semibold text-text underline underline-offset-4 hover:opacity-70"
                              >
                                {h.ticker}
                                <FileText
                                  size={11}
                                  className="text-accent-lilac"
                                />
                              </Link>
                            ) : (
                              <span className="font-mono text-[14px] font-semibold">
                                {h.ticker ?? "—"}
                              </span>
                            )}
                            {h.is_house_money && (
                              <span
                                className="badge badge-buy !px-2 !text-[9px]"
                                title="The original stake has already been recovered via a Winners Circle partial sell — this position is running on profit."
                              >
                                House
                              </span>
                            )}
                          </span>
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-3 py-3.5 font-sans text-[12px] text-text-muted sm:px-5">
                        {h.sector?.trim() || (
                          <span className="text-text-dim">Unclassified</span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-3 py-3.5 sm:px-5">
                        <span className="block font-mono text-[12px] tabular-nums text-text-muted">
                          {formatCompactUsd(h.market_cap)}
                        </span>
                        {tier && (
                          <span className="mt-0.5 block font-sans text-[9px] tracking-[0.08em] text-text-dim">
                            {tier.toUpperCase()} CAP
                          </span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-3 py-3.5 sm:px-5">
                        <span className="flex items-center gap-2">
                          <span className="font-mono text-[12px] tabular-nums text-text-muted">
                            {typeof h.weight_pct === "number"
                              ? `${h.weight_pct.toFixed(1)}%`
                              : "—"}
                          </span>
                          {/* A 40px bar as the shape of the number. Read at
                              a glance down the column, not per cell. */}
                          {typeof h.weight_pct === "number" && (
                            <span
                              className="hidden h-1 w-10 overflow-hidden rounded-full bg-bg-tertiary md:block"
                              aria-hidden
                            >
                              <span
                                className="block h-full rounded-full bg-accent-mint"
                                style={{
                                  width: `${Math.min(100, Math.max(0, h.weight_pct))}%`,
                                }}
                              />
                            </span>
                          )}
                        </span>
                      </td>
                      <td className="px-3 py-3.5 sm:px-5">
                        {rating.kind === "unrated" ? (
                          <span
                            className="font-mono text-[11px] text-text-dim"
                            title={rating.title}
                          >
                            {rating.label}
                          </span>
                        ) : (
                          <span className="block">
                            <span
                              className={`badge ${rating.badgeClass}`}
                              title={rating.title}
                            >
                              {rating.label}
                            </span>
                            {rating.detail && (
                              <span className="mt-1 block font-sans text-[10px] leading-snug text-text-dim">
                                {rating.detail}
                              </span>
                            )}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-3.5 font-mono text-[12px] text-text-muted sm:px-5">
                        {h.entry_date ?? "—"}
                      </td>
                      <td className="px-3 py-3.5 font-mono text-[12px] tabular-nums text-text-muted sm:px-5">
                        {held === null ? "—" : `${held}d`}
                      </td>
                      <td
                        className={`px-3 py-3.5 font-mono text-[13px] font-semibold tabular-nums sm:px-5 ${pnlClass(
                          h.pnl_pct,
                        )}`}
                      >
                        {formatPctOrDash(h.pnl_pct)}
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
