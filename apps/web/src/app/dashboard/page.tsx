"use client";

import { useStrategy } from "@/lib/hooks/use-strategy";
import { usePicks } from "@/lib/hooks/use-picks";
import { buildPicksComparison, useChart } from "@/lib/hooks/use-chart";
import { usePeriodReturns } from "@/lib/hooks/use-period-returns";
import { coverageNote, periodCaption } from "@/lib/period-returns";
import { StatTile } from "@/components/dashboard/stat-tile";
import { InsightsCard } from "@/components/dashboard/insights-card";
import { HoldingsPulse } from "@/components/dashboard/holdings-pulse";
import { resolvePageAccessState } from "@/components/dashboard/access-state";
import {
  leadersLaggardsEmptyCopy,
  splitLeadersAndLaggards,
} from "@/components/dashboard/pulse-model";
import { CompanyLogo } from "@/components/ui/company-logo";
import {
  DataState,
  DataStateCard,
  hasDataState,
  resolveDataState,
  type DataStateKind,
} from "@/components/ui/data-state";
import {
  computePortfolioReturnPct,
  daysUntilCalendarDate,
  describeDaysUntil,
  formatPctOrDash,
  formatWeekdayDate,
  pnlClass,
  pnlTone,
} from "@/lib/portfolio";
import {
  TrendingUp,
  Layers,
  ArrowUpRight,
  CalendarDays,
  LineChart,
} from "lucide-react";
import Link from "next/link";
import { PerformanceMethodology } from "@/components/ui/performance-methodology";

/**
 * States where showing the dashboard chrome at all is a lie — the user is not
 * allowed to see any of it, so a single prompt beats four stat cards of dashes
 * and three copies of the same message.
 */
function isGate(state: DataStateKind | null): state is "unauthenticated" | "subscription" {
  return state === "unauthenticated" || state === "subscription";
}


export default function DashboardPage() {
  const strategyQuery = useStrategy();
  const picksQuery = usePicks("active");
  // Like-for-like S&P: the same dollars, on the same dates, into SPY.
  // Not the index's own calendar move, and not the cash book.
  const chartQuery = useChart("inception");
  const periodQuery = usePeriodReturns();
  const { data: strategy } = strategyQuery;
  const { data: picksData } = picksQuery;

  const portfolio = strategy?.portfolio;
  const holdings = strategy?.holdings;
  const strategyMeta = strategy?.strategy;

  const strategyState = resolveDataState({
    isPending: strategyQuery.isPending,
    isError: strategyQuery.isError,
    error: strategyQuery.error,
    isEmpty: (holdings?.length ?? 0) === 0,
  });
  const picksState = resolveDataState({
    isPending: picksQuery.isPending,
    isError: picksQuery.isError,
    error: picksQuery.error,
    isEmpty: (picksData?.picks?.length ?? 0) === 0,
  });

  // `/strategy` deliberately answers 200 with ticker-less holdings for public
  // surfaces. Picks is the authoritative entitlement check, so do not render
  // those anonymized rows while it is pending or failed.
  const pageState = resolvePageAccessState(picksState, strategyState);
  const gate = isGate(pageState) ? pageState : null;

  const strategyFailed = strategyState === "error";

  // What the picks did with the money put into them. Each name is entered at
  // the same size, and closed picks stay in so a sold loser does not vanish.
  // Unknown stays an em dash — never coerced to 0.
  const picksReturnPct = computePortfolioReturnPct(strategy);
  const spyComparison = buildPicksComparison(chartQuery.data);
  const spyReturnPct =
    spyComparison.benchmarks.find((b) => b.key === "SPY")?.latestPct ?? null;
  const month = periodQuery.data?.periods.find((p) => p.id === "month");

  // The two ends of the open book by unrealized P&L. Disjoint by construction,
  // and unknown returns are in neither — see splitLeadersAndLaggards.
  const { leaders, laggards } = holdings
    ? splitLeadersAndLaggards(holdings)
    : { leaders: undefined, laggards: undefined };
  const scoredCount =
    holdings?.filter(
      (h) => typeof h.pnl_pct === "number" && Number.isFinite(h.pnl_pct),
    ).length ?? 0;

  const maxPositions = strategyMeta?.max_positions ?? null;

  let subtitle = "Loading...";
  if (gate) {
    subtitle =
      gate === "subscription" ? "Subscription required" : "Sign in to continue";
  } else if (pageState === "loading") {
    subtitle = "Checking access...";
  } else if (pageState === "error" || strategyFailed) {
    subtitle = "Live data unavailable";
  } else if (strategyMeta) {
    // Deliberately not strategyMeta.name — that is the internal portfolio
    // label ("AP Strategy") and means nothing to a subscriber.
    subtitle = `Live portfolio · ${strategyMeta.evaluation_frequency} evaluation`;
  }

  const nextPick = formatWeekdayDate(strategy?.next_evaluation_date);
  const untilNextPick = describeDaysUntil(
    daysUntilCalendarDate(strategy?.next_evaluation_date),
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="font-sans text-[13px] text-text-dim mt-1">{subtitle}</p>
        </div>
        {!gate && pageState !== "error" && !strategyFailed && (
          <NextPick
            date={nextPick}
            until={untilNextPick}
            pending={strategyQuery.isPending && !nextPick}
          />
        )}
      </div>

      {pageState ? (
        <DataStateCard
          state={pageState}
          error={picksQuery.error ?? strategyQuery.error}
        />
      ) : (
        <>
          {/* Four figures. Picks return is the equal-size record. S&P is the
              same dollars on the same dates, not the index's own move. */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatTile
              label="PICKS RETURN"
              value={formatPctOrDash(picksReturnPct)}
              caption="Each pick entered at the same size. Closed picks included."
              icon={TrendingUp}
              tone="mint"
              valueTone={pnlTone(picksReturnPct)}
              loading={strategyQuery.isPending}
            />
            <StatTile
              label="S&P 500"
              value={formatPctOrDash(spyReturnPct)}
              caption="Same dollars, same dates as the picks."
              icon={LineChart}
              tone="cyan"
              valueTone={pnlTone(spyReturnPct)}
              loading={chartQuery.isPending}
              help={
                <PerformanceMethodology
                  align="end"
                  inceptionDate={chartQuery.data?.summary?.inception_date}
                  latestDate={spyComparison.latestDate}
                />
              }
            />
            <StatTile
              label="THIS MONTH"
              value={formatPctOrDash(month?.open_picks_return_pct)}
              caption={month ? periodCaption(month) : undefined}
              note={coverageNote(month)}
              icon={CalendarDays}
              tone="lilac"
              valueTone={pnlTone(month?.open_picks_return_pct)}
              loading={periodQuery.isPending}
            />
            <StatTile
              label="POSITIONS"
              value={portfolio ? portfolio.position_count.toString() : "—"}
              caption={
                maxPositions
                  ? `Open now · cap ${maxPositions} · equal size at entry`
                  : "Open now · equal size at entry"
              }
              icon={Layers}
              tone="mint"
              loading={strategyQuery.isPending}
            />
          </div>

          {/* The curve, its range control, and the short-horizon numbers all
              live on /dashboard/performance now. This page is a glance: the
              four figures above, then what the book holds and what we wrote
              about it. Carrying the chart AND the benchmark tiles AND the
              period tiles here made it a second copy of that page. */}
          {strategyFailed ? (
            <DataStateCard
              state="error"
              error={strategyQuery.error}
              onRetry={() => void strategyQuery.refetch()}
            />
          ) : (
            <>
              {/* "Top / worst performers" were two sorts of one list. On a
                  book of five names they showed the same rows twice; on an
                  all-green book "worst" was full of gains. These are the two
                  ends of an unrealized ranking, and say so. */}
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <HoldingsCard
                  title="LEADING"
                  holdings={leaders}
                  state={strategyState}
                  emptyMessage={leadersLaggardsEmptyCopy(
                    "leaders",
                    holdings?.length ?? 0,
                    scoredCount,
                  )}
                />
                <HoldingsCard
                  title="TRAILING"
                  holdings={laggards}
                  state={strategyState}
                  emptyMessage={leadersLaggardsEmptyCopy(
                    "laggards",
                    holdings?.length ?? 0,
                    scoredCount,
                  )}
                />
              </div>

              {holdings && holdings.length > 0 && (
                <HoldingsPulse holdings={holdings} />
              )}
            </>
          )}

          {/* No "recent picks" panel any more. Its four rows were the four
              newest entry dates, which the Leading/Trailing lists already
              print beside every name — the same tickers appeared three times
              on one screen. Positions sorts by entry date for anyone who wants
              recency on its own. */}
          <InsightsCard holdings={holdings} />

          <Link
            href="/dashboard/strategy"
            className="group block data-card transition-colors duration-150 hover:bg-bg-tertiary"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <span className="panel-label block mb-1">
                  METHODOLOGY
                </span>
                <p className="font-sans text-[14px] font-semibold">
                  How the strategy works &middot; Backtrained model data sheet
                </p>
                <p className="font-sans text-[12px] text-text-muted mt-1">
                  Everything above is live performance. The backtrained model is
                  documented separately so simulation is never mistaken for it.
                </p>
              </div>
              <ArrowUpRight
                size={18}
                strokeWidth={2}
                className="mt-1 shrink-0 text-text-dim transition-[color,transform] duration-150 ease-out-strong group-hover:translate-x-0.5 group-hover:text-text motion-reduce:transition-none"
              />
            </div>
          </Link>
        </>
      )}
    </div>
  );
}


function NextPick({
  date,
  until,
  pending,
}: {
  date: string | null;
  until: string | null;
  pending: boolean;
}) {
  if (!pending && !date) return null;

  return (
    <div className="sm:text-right">
      <span className="field-label">Next pick</span>
      <p className="mt-0.5 font-mono text-[16px] font-bold leading-tight tabular-nums">
        {pending ? (
          <span className="inline-block h-[18px] w-28 animate-pulse rounded bg-bg-tertiary align-middle" />
        ) : (
          <>
            {date}
            {until && (
              <span className="ml-2 font-sans text-[12px] font-medium text-text-dim">
                {until}
              </span>
            )}
          </>
        )}
      </p>
      <p className="mt-0.5 font-sans text-[12px] text-text-dim">Every other week</p>
    </div>
  );
}

function HoldingsCard({
  title,
  holdings,
  state,
  emptyMessage = "The book is empty right now.",
}: {
  title: string;
  holdings:
    | { ticker: string | null; pnl_pct: number | null; entry_date: string | null }[]
    | undefined;
  state: DataStateKind | null;
  emptyMessage?: string;
}) {
  // A list that resolved to nothing (every scored name is in the other
  // panel) is an empty state of its own, distinct from the query being empty.
  const localState: DataStateKind | null =
    state ?? (holdings && holdings.length === 0 ? "empty" : null);

  return (
    <div className="data-panel">
      <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-4">
        <span className="flex min-w-0 flex-wrap items-baseline gap-x-2.5 gap-y-0.5">
          <span className="panel-label panel-label-mint">{title}</span>
          {/* The qualifier the label needs. These are marks on positions we
              still hold, against cost — not a track record. */}
          <span className="font-sans text-[10px] font-medium tracking-[0.06em] text-text-dim">
            OPEN P&amp;L · UNREALIZED
          </span>
        </span>
        <Link
          href="/dashboard/positions"
          className="flex shrink-0 items-center gap-1 font-sans text-[10px] font-bold tracking-[0.08em] text-text underline underline-offset-2 hover:opacity-70"
        >
          ALL POSITIONS <ArrowUpRight size={10} strokeWidth={2.5} />
        </Link>
      </div>
      <div className="divide-y divide-border-light">
        {hasDataState(localState) ? (
          <DataState
            compact
            state={localState}
            emptyTitle="Nothing to show"
            emptyMessage={emptyMessage}
          />
        ) : (
          holdings?.map((h, index) => (
            <div
              // Index is only the defensive fallback for identity-stripped
              // public rows; resolvePageAccessState prevents those rows from
              // rendering on this paid surface in normal operation.
              key={h.ticker ?? `anonymous-holding-${index}`}
              className="flex items-center justify-between px-5 py-3 transition-colors duration-100 hover:bg-bg-tertiary/50"
            >
              <div className="flex items-center gap-3">
                <CompanyLogo ticker={h.ticker} size="sm" />
                <span className="w-14 font-mono text-[14px] font-semibold">
                  {h.ticker}
                </span>
                <span className="font-mono text-[11px] text-text-dim">
                  Entered {h.entry_date ?? "—"}
                </span>
              </div>
              <span
                className={`font-mono text-[13px] font-semibold tabular-nums ${pnlClass(
                  h.pnl_pct,
                )}`}
              >
                {formatPctOrDash(h.pnl_pct)}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
