"use client";

import { CalendarClock, Layers, Percent, Trophy } from "lucide-react";
import { StatTile } from "@/components/dashboard/stat-tile";
import { useStrategy } from "@/lib/hooks/use-strategy";
import { usePicks } from "@/lib/hooks/use-picks";
import {
  daysUntilCalendarDate,
  describeDaysUntil,
  formatPctOrDash,
  formatWeekdayDate,
  pnlTone,
} from "@/lib/portfolio";
import { closedSummary, openSummary } from "./positions-model";

/**
 * The book at a glance, above the list. Everything here was already in the
 * two payloads the page loads; none of it was printed on Positions, so "how
 * many of these are working" meant counting green cells.
 */
export function PositionsSummary() {
  const strategyQuery = useStrategy();
  const closedQuery = usePicks("closed");
  const strategy = strategyQuery.data;
  const open = openSummary(strategy?.holdings ?? []);
  const closed = closedSummary(closedQuery.data?.picks ?? []);
  const maxPositions = strategy?.strategy?.max_positions ?? null;

  const nextEval = formatWeekdayDate(strategy?.next_evaluation_date);
  const untilNext = describeDaysUntil(
    daysUntilCalendarDate(strategy?.next_evaluation_date),
  );

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <StatTile
        label="OPEN"
        value={
          strategy
            ? maxPositions
              ? `${open.count}/${maxPositions}`
              : open.count.toString()
            : "—"
        }
        // Unrealized marks on running positions. Deliberately not a win rate.
        caption={
          open.scored > 0
            ? `${open.above} above cost · ${open.below} below`
            : "No marked positions"
        }
        icon={Layers}
        tone="mint"
        loading={strategyQuery.isPending}
      />
      <StatTile
        label="AVG OPEN RETURN"
        value={formatPctOrDash(open.avgPct, 1)}
        valueTone={pnlTone(open.avgPct)}
        caption="Unrealized, each open name weighted equally."
        icon={Percent}
        tone="cyan"
        loading={strategyQuery.isPending}
      />
      <StatTile
        label="CLOSED WIN RATE"
        value={
          closed.winRatePct === null ? "—" : `${Math.round(closed.winRatePct)}%`
        }
        caption={
          closed.scored > 0
            ? `${closed.wins} of ${closed.scored} · avg win ${formatPctOrDash(closed.avgWinPct, 1)} · avg loss ${formatPctOrDash(closed.avgLossPct, 1)}`
            : "Nothing closed yet. Open names don't count."
        }
        icon={Trophy}
        tone="lilac"
        loading={closedQuery.isPending}
      />
      <StatTile
        label="NEXT EVALUATION"
        value={nextEval ?? "—"}
        caption={
          untilNext
            ? `${untilNext[0].toUpperCase()}${untilNext.slice(1)} · next scheduled strategy run.`
            : "Next scheduled strategy run."
        }
        icon={CalendarClock}
        tone="yellow"
        loading={strategyQuery.isPending}
      />
    </div>
  );
}
