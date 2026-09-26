"use client";

import { Fragment, useState } from "react";
import { ArrowDown, ArrowUp, ChevronRight, Minus } from "lucide-react";
import { useStrategy } from "@/lib/hooks/use-strategy";
import { usePicks } from "@/lib/hooks/use-picks";
import {
  DataStateRow,
  hasDataState,
  resolveDataState,
} from "@/components/ui/data-state";
import {
  asShareOfInvested,
  groupBySector,
  sectorPositionCap,
  UNCLASSIFIED,
} from "@/components/dashboard/sector-model";
import {
  FilterChips,
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
import { CompanyLogo } from "@/components/ui/company-logo";
import { TONE_BG } from "@/lib/tones";
import { holdingSignals, type HoldingSignals } from "./positions-model";

type SortKey = "ticker" | "pnl_pct" | "weight_pct" | "held" | "upside";
type Grouping = "none" | "sector";

/**
 * Return sits next to the name so it survives a phone-width viewport; the
 * static facts (sector, size, entry date) moved to the drawer, where they
 * are read once rather than scanned every visit.
 */
function buildColumns(ratingNote: string | null): readonly Column<SortKey>[] {
  return [
    { label: "POSITION", sortKey: "ticker" },
    { label: "RETURN", sortKey: "pnl_pct" },
    { label: "WEIGHT", sortKey: "weight_pct", note: "of invested" },
    { label: "RATING", note: ratingNote ?? undefined },
    { label: "HELD", sortKey: "held" },
    { label: "SIGNALS", note: "last print · estimates" },
    { label: "STREET", sortKey: "upside", note: "to mean target" },
    { label: "" },
  ];
}

function EarningsChip({ s }: { s: HoldingSignals }) {
  if (!s.earnings) {
    return <span className="font-mono text-[11px] text-text-dim">—</span>;
  }
  const label =
    s.earnings === "beat" ? "Beat" : s.earnings === "miss" ? "Miss" : "In line";
  const cls =
    s.earnings === "beat"
      ? "text-accent-green"
      : s.earnings === "miss"
        ? "text-accent-red"
        : "text-text-muted";
  return (
    <span
      className={`font-sans text-[11px] font-semibold ${cls}`}
      title={`${s.earningsBasis} ${formatPctOrDash(s.earningsSurprisePct, 1)} vs estimate on the latest report`}
    >
      {label}
    </span>
  );
}

function RevisionChip({ s }: { s: HoldingSignals }) {
  if (!s.revisions) {
    return <span className="font-mono text-[11px] text-text-dim">—</span>;
  }
  const Icon =
    s.revisions === "up" ? ArrowUp : s.revisions === "down" ? ArrowDown : Minus;
  const cls =
    s.revisions === "up"
      ? "text-accent-green"
      : s.revisions === "down"
        ? "text-accent-red"
        : "text-text-muted";
  const word =
    s.revisions === "up" ? "raised" : s.revisions === "down" ? "cut" : "unchanged";
  return (
    <span
      className={`inline-flex items-center gap-0.5 font-sans text-[11px] font-semibold ${cls}`}
      title={`Forward EPS consensus ${word} (${formatPctOrDash(s.revisionPct, 1)}) since the prior snapshot`}
    >
      <Icon size={11} strokeWidth={2.5} aria-hidden />
      Est.
    </span>
  );
}

export function PositionsOpen({
  onSelect,
}: {
  onSelect: (ticker: string) => void;
}) {
  const strategyQuery = useStrategy();
  const picksQuery = usePicks("active");
  const { data: strategy, isPending, isError, error } = strategyQuery;
  const holdings = strategy?.holdings
    ? asShareOfInvested(strategy.holdings)
    : undefined;

  const [sortKey, setSortKey] = useState<SortKey>("pnl_pct");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [grouping, setGrouping] = useState<Grouping>("none");

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else {
      setSortKey(key);
      setSortDir(key === "ticker" ? "asc" : "desc");
    }
  };

  // The strategy endpoint knows the position; the picks endpoint knows the
  // current rating.
  const signalByTicker = new Map(
    (picksQuery.data?.picks ?? []).map((p) => [p.ticker, p.signal]),
  );
  const ratingDate = formatDayMonth(picksQuery.data?.rating_as_of ?? null);
  const columns = buildColumns(ratingDate && `as of ${ratingDate}`);
  const minHoldingDays =
    typeof strategy?.params?.min_holding_days === "number"
      ? strategy.params.min_holding_days
      : null;

  const rows = (holdings ?? []).map((h) => ({
    h,
    signals: holdingSignals(h),
    held: calendarDaysHeld(h.entry_date),
  }));
  type Row = (typeof rows)[number];

  const compare = (a: Row, b: Row): number => {
    // Unknowns sort last in both directions, so the flip must not touch them.
    if (sortKey === "pnl_pct") return comparePnl(a.h.pnl_pct, b.h.pnl_pct, sortDir);
    if (sortKey === "weight_pct")
      return comparePnl(a.h.weight_pct, b.h.weight_pct, sortDir);
    if (sortKey === "upside")
      return comparePnl(a.signals.upsidePct, b.signals.upsidePct, sortDir);
    if (sortKey === "held") return comparePnl(a.held, b.held, sortDir);
    const cmp = (a.h.ticker ?? "").localeCompare(b.h.ticker ?? "");
    return sortDir === "asc" ? cmp : -cmp;
  };
  const sorted = [...rows].sort(compare);

  const sectorCap = sectorPositionCap(
    typeof strategy?.params?.sector_concentration === "number"
      ? strategy.params.sector_concentration
      : null,
    strategy?.strategy?.max_positions ?? null,
  );
  const groups =
    grouping === "sector" && holdings
      ? groupBySector(holdings).map((slice) => ({
          slice,
          rows: sorted.filter(
            (r) => (r.h.sector?.trim() || UNCLASSIFIED) === slice.sector,
          ),
        }))
      : null;

  const state = resolveDataState({
    isPending,
    isError,
    error,
    isEmpty: rows.length === 0,
  });

  const renderRow = ({ h, signals, held }: Row, index: number) => {
    const ticker = h.ticker;
    const rating = describeOpenRating({
      signal: ticker ? signalByTicker.get(ticker) : undefined,
      entryDate: h.entry_date,
      minHoldingDays,
      ratingAsOf: ratingDate,
    });
    return (
      <tr
        key={ticker ?? h.entry_date ?? `anonymous-holding-${index}`}
        onClick={ticker ? () => onSelect(ticker) : undefined}
        className="group cursor-pointer border-b border-border transition-colors duration-100 last:border-b-0 hover:bg-bg-tertiary/50"
      >
        <td className="sticky-col px-3 py-3 group-hover:bg-bg-tertiary sm:px-5">
          <span className="flex items-center gap-2.5">
            <CompanyLogo ticker={ticker} size="sm" />
            <span className="min-w-0">
              <span className="flex items-center gap-2">
                {ticker ? (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelect(ticker);
                    }}
                    className="font-mono text-[14px] font-semibold text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
                  >
                    {ticker}
                  </button>
                ) : (
                  <span className="font-mono text-[14px] font-semibold">—</span>
                )}
                {h.is_house_money && (
                  <span
                    className="badge badge-buy !px-2 !text-[9px]"
                    title="A Winners Circle partial sell already recovered the original stake. This position is running on profit."
                  >
                    House
                  </span>
                )}
              </span>
              {h.name && (
                <span className="mt-0.5 block max-w-[160px] truncate font-sans text-[11px] text-text-dim sm:max-w-[220px]">
                  {h.name}
                </span>
              )}
            </span>
          </span>
        </td>
        <td
          className={`whitespace-nowrap px-3 py-3 font-mono text-[14px] font-semibold tabular-nums sm:px-5 ${pnlClass(h.pnl_pct)}`}
        >
          {formatPctOrDash(h.pnl_pct, 1)}
        </td>
        <td className="whitespace-nowrap px-3 py-3 sm:px-5">
          <span className="flex items-center gap-2">
            <span className="font-mono text-[12px] tabular-nums text-text-muted">
              {typeof h.weight_pct === "number"
                ? `${h.weight_pct.toFixed(1)}%`
                : "—"}
            </span>
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
        <td className="px-3 py-3 sm:px-5">
          {rating.kind === "unrated" ? (
            <span
              className="font-mono text-[11px] text-text-dim"
              title={rating.title}
            >
              {rating.label}
            </span>
          ) : (
            <span className={`badge ${rating.badgeClass}`} title={rating.title}>
              {rating.label}
            </span>
          )}
        </td>
        <td className="whitespace-nowrap px-3 py-3 font-mono text-[12px] tabular-nums text-text-muted sm:px-5">
          {held === null ? "—" : `${held}d`}
        </td>
        <td className="whitespace-nowrap px-3 py-3 sm:px-5">
          <span className="flex items-center gap-3">
            <EarningsChip s={signals} />
            <RevisionChip s={signals} />
          </span>
        </td>
        <td
          className={`whitespace-nowrap px-3 py-3 font-mono text-[12px] tabular-nums sm:px-5 ${
            signals.upsidePct === null ? "text-text-dim" : "text-text-muted"
          }`}
        >
          {formatPctOrDash(signals.upsidePct, 0)}
        </td>
        <td className="px-2 py-3 text-text-dim">
          <ChevronRight
            size={14}
            className="transition-transform group-hover:translate-x-0.5"
            aria-hidden
          />
        </td>
      </tr>
    );
  };

  return (
    <div className="data-panel">
      <PanelHeader label="Open positions" tone="mint">
        <div className="flex flex-wrap items-center gap-3">
          <FilterChips
            options={["none", "sector"] as const}
            value={grouping}
            onChange={setGrouping}
            label="Group positions"
            labelFor={(g) => (g === "none" ? "All" : "By sector")}
          />
          <span className="font-mono text-[10px] text-text-dim">
            {isPending || isError ? "—" : `${rows.length} HOLDINGS`}
          </span>
        </div>
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
            ) : groups ? (
              groups.map(({ slice, rows: groupRows }) => {
                const atCap =
                  sectorCap !== null &&
                  slice.sector !== UNCLASSIFIED &&
                  slice.count >= sectorCap;
                return (
                  <Fragment key={slice.sector}>
                    <tr className="border-b border-border bg-bg-secondary/60">
                      <td colSpan={columns.length} className="px-3 py-2 sm:px-5">
                        <span className="sticky left-3 flex items-center gap-2.5 sm:left-5">
                          <span
                            className={`h-2 w-2 shrink-0 rounded-full ${
                              slice.tone ? TONE_BG[slice.tone] : "bg-border-strong"
                            }`}
                            aria-hidden
                          />
                          <span className="font-sans text-[12px] font-semibold text-text">
                            {slice.sector}
                          </span>
                          <span
                            className={`font-mono text-[10px] tabular-nums ${
                              atCap ? "text-accent-red" : "text-text-dim"
                            }`}
                            title={
                              sectorCap === null
                                ? undefined
                                : `${slice.count} of a maximum ${sectorCap} positions in one sector`
                            }
                          >
                            {sectorCap === null
                              ? `${slice.count} names`
                              : `${slice.count}/${sectorCap} names`}
                          </span>
                          <span className="font-mono text-[11px] font-semibold tabular-nums text-text-muted">
                            {slice.weightPct.toFixed(1)}%
                          </span>
                        </span>
                      </td>
                    </tr>
                    {groupRows.map(renderRow)}
                  </Fragment>
                );
              })
            ) : (
              sorted.map(renderRow)
            )}
          </tbody>
        </table>
      </HScroll>

      {groups && sectorCap !== null && (
        <p className="border-t border-border px-5 py-3 font-sans text-[11px] leading-relaxed text-text-dim">
          The strategy will not open a new position in a sector that already
          holds <span className="font-mono text-text-muted">{sectorCap}</span>{" "}
          names, and checks that on every buy. Existing positions are never
          force-sold to rebalance.
        </p>
      )}
    </div>
  );
}
