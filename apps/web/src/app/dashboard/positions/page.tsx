"use client";

import { useState } from "react";
import { useStrategy } from "@/lib/hooks/use-strategy";
import { usePicks } from "@/lib/hooks/use-picks";
import { DataStateCard, resolveDataState } from "@/components/ui/data-state";
import { Tabs, TabPanel, type TabDef } from "@/components/dashboard/tabs";
import { PositionsOpen } from "@/components/dashboard/positions-open";
import { PositionsClosed } from "@/components/dashboard/positions-closed";
import { PositionsActivity } from "@/components/dashboard/positions-activity";

type TabId = "open" | "closed" | "activity";

/**
 * One surface for the book.
 *
 * Portfolio, Pick history and Trades were three nav items over one object:
 * Portfolio listed today's holdings, Pick history listed the same rows again
 * under "active" plus the closed ones, and Trades was the event log that
 * produced both. Three pages forced the reader to learn our data model to
 * answer "what do we own and what happened to it".
 */
export default function PositionsPage() {
  const [tab, setTab] = useState<TabId>("open");

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
  const isGate = (s: string | null) =>
    s === "unauthenticated" || s === "subscription";

  const strategyGate = gateFrom(strategyQuery);
  const closedGate = gateFrom(closedQuery);
  const gate = isGate(strategyGate)
    ? (strategyGate as "unauthenticated" | "subscription")
    : isGate(closedGate)
      ? (closedGate as "unauthenticated" | "subscription")
      : null;

  const tabs: readonly TabDef<TabId>[] = [
    { id: "open", label: "Open", badge: openCount?.toString() },
    { id: "closed", label: "Closed", badge: closedCount?.toString() },
    { id: "activity", label: "Activity" },
  ];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="page-title">Positions</h1>
        <p className="mt-1 font-sans text-[13px] text-text-dim">
          {gate
            ? gate === "subscription"
              ? "Subscription required"
              : "Sign in to continue"
            : "What the book holds, what it closed, and every trade behind it"}
        </p>
      </div>

      {gate ? (
        <DataStateCard state={gate} error={strategyQuery.error} />
      ) : (
        <div>
          <Tabs
            tabs={tabs}
            value={tab}
            onChange={setTab}
            label="Position views"
          />
          {tab === "open" && (
            <TabPanel id="open">
              <PositionsOpen />
            </TabPanel>
          )}
          {tab === "closed" && (
            <TabPanel id="closed">
              <PositionsClosed />
            </TabPanel>
          )}
          {tab === "activity" && (
            <TabPanel id="activity">
              <PositionsActivity />
            </TabPanel>
          )}
        </div>
      )}
    </div>
  );
}
