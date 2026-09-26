"use client";

import { usePicks } from "@/lib/hooks/use-picks";
import { useStrategy } from "@/lib/hooks/use-strategy";
import { PerformanceChart } from "@/components/dashboard/performance-chart";
import {
  MonthlyReturns,
  PickScorecard,
  RecentPeriods,
  TrackRecordStats,
} from "@/components/dashboard/track-record";
import { resolvePageAccessState } from "@/components/dashboard/access-state";
import { DataStateCard, resolveDataState } from "@/components/ui/data-state";

/**
 * Everything about how the book is doing, at every horizon.
 *
 * This was spread across the dashboard home, which ended up carrying the
 * curve, the benchmark tiles, the short-horizon numbers and four other panels
 * — too much for a page whose job is a glance. The home keeps the glance; the
 * detail lives here.
 *
 * Reading top to bottom, the way a fund factsheet does: the curve against
 * the indexes, then the key statistics beside the short-term numbers, then
 * month by month, then every pick against the S&P over its own holding
 * period. The per-position today/week/month table that used to close the
 * page repeated Positions; the scorecard replaces it with the comparison a
 * picking record is actually judged on.
 */
export default function PerformancePage() {
  // The chart is public data, but the per-position table below it is not, so
  // the page is gated on the same query that gates Positions. /api/data/picks
  // answers 402 to a signed-in non-subscriber, which /api/data/performance
  // never does.
  const picksQuery = usePicks("active");
  const strategyQuery = useStrategy();

  const gateFrom = (q: { isPending: boolean; isError: boolean; error: unknown }) =>
    resolveDataState({
      isPending: q.isPending,
      isError: q.isError,
      error: q.error,
      isEmpty: false,
    });
  const pageState = resolvePageAccessState(
    gateFrom(picksQuery),
    gateFrom(strategyQuery),
  );

  let subtitle = "The picks against the market — cumulative, month by month, and pick by pick";
  if (pageState === "subscription") subtitle = "Subscription required";
  else if (pageState === "unauthenticated") subtitle = "Sign in to continue";
  else if (pageState === "loading") subtitle = "Checking access...";
  else if (pageState === "error") subtitle = "Live data unavailable";

  return (
    <div className="space-y-5">
      <div>
        <h1 className="page-title">Performance</h1>
        <p className="mt-1 font-sans text-[13px] text-text-dim">{subtitle}</p>
      </div>

      {pageState ? (
        <DataStateCard
          state={pageState}
          error={picksQuery.error ?? strategyQuery.error}
        />
      ) : (
        <>
          <PerformanceChart />
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <TrackRecordStats />
            </div>
            <RecentPeriods />
          </div>
          <MonthlyReturns />
          <PickScorecard />
        </>
      )}
    </div>
  );
}
