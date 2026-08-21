"use client";

import { useStrategy } from "@/lib/hooks/use-strategy";
import { useInceptionDate } from "@/lib/hooks/use-inception";
import { usePicks } from "@/lib/hooks/use-picks";
import { LiveStatus } from "@/components/dashboard/live-status";
import { PerformanceChart } from "@/components/dashboard/performance-chart";
import { StatTile } from "@/components/dashboard/stat-tile";
import { InsightsCard } from "@/components/dashboard/insights-card";
import { resolvePageAccessState } from "@/components/dashboard/access-state";
import { CompanyLogo } from "@/components/ui/company-logo";
import {
  DataState,
  DataStateCard,
  hasDataState,
  resolveDataState,
  type DataStateKind,
} from "@/components/ui/data-state";
import {
  closedWinRate,
  comparePnl,
  computePortfolioReturnPct,
  daysSinceInception,
  formatPct,
  formatPctOrDash,
  pnlClass,
} from "@/lib/portfolio";
import {
  TrendingUp,
  Activity,
  Layers,
  ArrowUpRight,
  Trophy,
} from "lucide-react";
import Link from "next/link";

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
  // Closed picks drive the win rate — the only version of that number the
  // product can stand behind.
  const closedQuery = usePicks("closed");
  const { inceptionISO } = useInceptionDate();
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

  // Portfolio total return % derived from holdings — UI never shows dollars.
  const computedReturnPct = computePortfolioReturnPct(strategy);
  const totalReturnPct = computedReturnPct ?? 0;
  const hasReturn = computedReturnPct !== null;

  // The win rate is RESOLVED results only — closed positions that finished
  // above cost. The tile used to count open positions marked in the green,
  // which reads as a track record but is unrealized: a book that opened into a
  // rising fortnight shows 8 of 8 having proven nothing, and the number falls
  // apart the moment the market turns.
  const winRate = closedWinRate(closedQuery.data?.picks);

  // Top 5 holdings by P&L
  const topHoldings = holdings
    ? [...holdings].sort((a, b) => comparePnl(a.pnl_pct, b.pnl_pct, "desc")).slice(0, 5)
    : undefined;

  // Bottom 5 holdings by P&L
  const bottomHoldings = holdings
    ? [...holdings].sort((a, b) => comparePnl(a.pnl_pct, b.pnl_pct, "asc")).slice(0, 5)
    : undefined;

  const days = daysSinceInception(inceptionISO);

  // Most recent picks (sorted by entry date desc)
  const recentPicks = picksData?.picks
    ? [...picksData.picks]
        .sort((a, b) => b.entry_date.localeCompare(a.entry_date))
        .slice(0, 4)
    : undefined;

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

  return (
    <div className="space-y-5">
      <div>
        <h1 className="page-title">Dashboard</h1>
        <p className="font-sans text-[13px] text-text-dim mt-1">{subtitle}</p>
      </div>

      {pageState ? (
        <DataStateCard
          state={pageState}
          error={picksQuery.error ?? strategyQuery.error}
        />
      ) : (
        <>
          {/* Live status banner */}
          <LiveStatus />

          {/* Live stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <StatTile
              label="PICKS RETURN"
              value={hasReturn ? formatPct(totalReturnPct) : "—"}
              icon={TrendingUp}
              tone="mint"
              valueTone={
                !hasReturn ? "neutral" : totalReturnPct >= 0 ? "green" : "red"
              }
              loading={strategyQuery.isPending}
            />
            <StatTile
              label="POSITIONS"
              value={portfolio ? portfolio.position_count.toString() : "—"}
              icon={Layers}
              tone="mint"
              loading={strategyQuery.isPending}
            />
            {/* Reads "—" until there are exits. Zero closed positions is "no
                record yet"; rendering it as 0% would be a claim, and a false
                one. */}
            <StatTile
              label="WIN RATE"
              value={
                winRate.pct === null
                  ? "—"
                  : `${winRate.wins} / ${winRate.total}`
              }
              icon={Trophy}
              tone="mint"
              loading={closedQuery.isPending}
            />
            <StatTile
              label="DAYS LIVE"
              value={days.toString()}
              icon={Activity}
              tone="mint"
              loading={strategyQuery.isPending}
            />
          </div>

          {/* Full size, not compact: the vs-benchmark gap tiles only render
              at full size, and they were the one thing the Performance page
              carried that this one did not. */}
          <PerformanceChart />

          {strategyFailed ? (
            <DataStateCard
              state="error"
              error={strategyQuery.error}
              onRetry={() => void strategyQuery.refetch()}
            />
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <HoldingsCard
                title="TOP PERFORMERS"
                holdings={topHoldings}
                state={strategyState}
              />
              <HoldingsCard
                title="WORST PERFORMERS"
                holdings={bottomHoldings}
                state={strategyState}
              />
            </div>
          )}

          <InsightsCard holdings={holdings} />

          <div className="data-panel">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <span className="panel-label panel-label-mint">
                RECENT PICKS
              </span>
              <Link
                href="/dashboard/positions"
                className="font-sans text-[10px] text-text font-bold tracking-[0.08em] underline underline-offset-2 hover:opacity-70 flex items-center gap-1"
              >
                ALL POSITIONS <ArrowUpRight size={10} />
              </Link>
            </div>
            <div className="divide-y divide-border-light">
              {hasDataState(picksState) ? (
                <DataState
                  compact
                  state={picksState}
                  error={picksQuery.error}
                  onRetry={() => void picksQuery.refetch()}
                  emptyTitle="No picks yet"
                  emptyMessage="The next pick lands on the biweekly evaluation. It will show up here first."
                />
              ) : (
                recentPicks?.map((p, i) => (
                  <div
                    key={`${p.ticker}-${i}`}
                    className="flex items-center justify-between gap-3 px-5 py-4 hover:bg-bg-tertiary/50 transition-colors"
                  >
                    <span className="flex min-w-0 flex-col sm:flex-row sm:items-center sm:gap-3">
                      <span className="font-mono text-[14px] font-semibold">
                        {p.ticker}
                      </span>
                      <span className="font-mono text-[11px] text-text-dim">
                        Entered {p.entry_date}
                      </span>
                    </span>
                    <span
                      className={`shrink-0 font-mono text-[12px] font-semibold tabular-nums ${pnlClass(
                        p.pnl_pct,
                      )}`}
                    >
                      {formatPctOrDash(p.pnl_pct)}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          <Link
            href="/dashboard/strategy"
            className="block data-card hover:bg-bg-tertiary transition-colors group"
          >
            <div className="flex items-center justify-between">
              <div>
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
                className="text-text-dim group-hover:opacity-70 transition-colors"
              />
            </div>
          </Link>
        </>
      )}
    </div>
  );
}


function HoldingsCard({
  title,
  holdings,
  state,
}: {
  title: string;
  holdings:
    | { ticker: string | null; pnl_pct: number | null; entry_date: string | null }[]
    | undefined;
  state: DataStateKind | null;
}) {
  return (
    <div className="data-panel">
      <div className="flex items-center justify-between px-5 py-4 border-b border-border">
        <span className="panel-label panel-label-mint">
          {title}
        </span>
        <Link
          href="/dashboard/positions"
          className="font-sans text-[11px] text-text font-semibold underline underline-offset-2 hover:opacity-70 flex items-center gap-1"
        >
          VIEW ALL <ArrowUpRight size={10} />
        </Link>
      </div>
      <div className="divide-y divide-border-light">
        {hasDataState(state) ? (
          <DataState
            compact
            state={state}
            emptyTitle="No holdings"
            emptyMessage="The book is empty right now."
          />
        ) : (
          holdings?.map((h, index) => (
            <div
              // Index is only the defensive fallback for identity-stripped
              // public rows; resolvePageAccessState prevents those rows from
              // rendering on this paid surface in normal operation.
              key={h.ticker ?? `anonymous-holding-${index}`}
              className="flex items-center justify-between px-5 py-3 hover:bg-bg-tertiary/50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <CompanyLogo ticker={h.ticker} size="sm" />
                <span className="font-mono text-[14px] font-semibold w-14">
                  {h.ticker}
                </span>
                <span className="font-mono text-[11px] text-text-dim">
                  Entered {h.entry_date ?? "—"}
                </span>
              </div>
              <span
                className={`font-mono text-[13px] font-semibold ${pnlClass(
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
