"use client";

import { useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useStrategy } from "@/lib/hooks/use-strategy";
import { usePicks } from "@/lib/hooks/use-picks";
import { DataStateCard, resolveDataState } from "@/components/ui/data-state";
import { Tabs, TabPanel, type TabDef } from "@/components/dashboard/tabs";
import { PositionsOpen } from "@/components/dashboard/positions-open";
import { PositionsClosed } from "@/components/dashboard/positions-closed";
import { PositionsActivity } from "@/components/dashboard/positions-activity";
import { PositionsSummary } from "@/components/dashboard/positions-summary";
import { PositionDrawer } from "@/components/dashboard/position-drawer";
import {
  parsePositionsView,
  type PositionsView,
} from "@/components/dashboard/positions-model";
import { resolvePageAccessState } from "@/components/dashboard/access-state";

/**
 * One surface for the book: a summary, one list (open or closed), the runs
 * that produced it, and a drawer per name.
 *
 * This was four tabs — open, fundamentals, closed, activity — each holding a
 * slice of the same positions, so learning how one name was doing meant
 * finding its row in three tables. Fundamentals now condense into the row
 * and expand in the drawer; the trade log sits under the list, grouped by
 * evaluation, and filtered per name inside the drawer.
 *
 * `?view=closed` and `?ticker=XYZ` are in the URL so a position can be
 * linked to. Pre-rebuild `?tab=` links still resolve.
 */
export default function PositionsPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const legacyTab = searchParams.get("tab");
  const view = parsePositionsView(searchParams.get("view") ?? legacyTab);
  const selected = searchParams.get("ticker");

  function update(
    patch: Record<string, string | null>,
    mode: "push" | "replace" = "replace",
  ) {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("tab");
    for (const [k, v] of Object.entries(patch)) {
      if (v === null) params.delete(k);
      else params.set(k, v);
    }
    const qs = params.toString();
    router[mode](qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  const setView = (next: PositionsView) =>
    update({ view: next === "open" ? null : next });
  // Push, so the browser's back button closes the drawer.
  const openTicker = (ticker: string) => update({ ticker }, "push");
  const closeTicker = () => update({ ticker: null });

  const strategyQuery = useStrategy();
  const closedQuery = usePicks("closed");

  const openCount = strategyQuery.data?.holdings?.length;
  const closedCount = closedQuery.data?.count;

  // Every tab sits behind the same paywall, so a gate replaces the whole page
  // rather than letting the user tab between three copies of the same prompt.
  //
  // Both queries are consulted deliberately. /api/data/strategy answers 200
  // to a signed-in non-subscriber with an ANONYMISED body — holdings with no
  // tickers — so entitlement cannot be inferred from its error state alone.
  // /api/data/picks answers 402 for the same caller, which is what actually
  // reveals the gate. Reading only the strategy query is how ticker-less rows
  // reached the table and crashed it.
  const gateFrom = (q: { isPending: boolean; isError: boolean; error: unknown }) =>
    resolveDataState({
      isPending: q.isPending,
      isError: q.isError,
      error: q.error,
      isEmpty: false,
    });
  const strategyGate = gateFrom(strategyQuery);
  const closedGate = gateFrom(closedQuery);
  const pageState = resolvePageAccessState(closedGate, strategyGate);

  let subtitle = "Every position, what the company is reporting, and why we traded it";
  if (pageState === "subscription") subtitle = "Subscription required";
  else if (pageState === "unauthenticated") subtitle = "Sign in to continue";
  else if (pageState === "loading") subtitle = "Checking access...";
  else if (pageState === "error") subtitle = "Live data unavailable";

  const tabs: readonly TabDef<PositionsView>[] = [
    { id: "open", label: "Open", badge: openCount?.toString() },
    { id: "closed", label: "Closed", badge: closedCount?.toString() },
  ];

  // Old "Activity" links now mean the evaluations block under the list.
  useEffect(() => {
    if (legacyTab === "activity" && !pageState) {
      document
        .getElementById("recent-evaluations")
        ?.scrollIntoView({ block: "start" });
    }
  }, [legacyTab, pageState]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="page-title">Positions</h1>
        <p className="mt-1 font-sans text-[13px] text-text-dim">
          {subtitle}
        </p>
      </div>

      {pageState ? (
        <DataStateCard
          state={pageState}
          error={closedQuery.error ?? strategyQuery.error}
        />
      ) : (
        <>
          <PositionsSummary />
          <div>
            <Tabs
              tabs={tabs}
              value={view}
              onChange={setView}
              label="Position views"
            />
            <TabPanel id={view}>
              <div className="pt-4">
                {view === "open" ? (
                  <PositionsOpen onSelect={openTicker} />
                ) : (
                  <PositionsClosed onSelect={openTicker} />
                )}
              </div>
            </TabPanel>
          </div>
          <div id="recent-evaluations" className="scroll-mt-20">
            <PositionsActivity onSelect={openTicker} />
          </div>
          {selected && (
            <PositionDrawer
              key={selected}
              ticker={selected}
              onClose={closeTicker}
            />
          )}
        </>
      )}
    </div>
  );
}
