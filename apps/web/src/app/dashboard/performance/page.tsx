"use client";

import { usePicks } from "@/lib/hooks/use-picks";
import { useStrategy } from "@/lib/hooks/use-strategy";
import { PerformanceChart } from "@/components/dashboard/performance-chart";
import { PeriodPerformance } from "@/components/dashboard/period-performance";
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
 * Reading top to bottom: the long view (the curve against the indexes, over a
 * range you choose), then the short view (today, this week, this month), then
 * the same short view broken out per position.
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

  let subtitle = "The picks against the indexes, and how they are doing now";
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
          <PeriodPerformance />
        </>
      )}
    </div>
  );
}
