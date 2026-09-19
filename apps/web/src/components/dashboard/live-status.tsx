"use client";

import { useStrategy } from "@/lib/hooks/use-strategy";
import { useInceptionDate } from "@/lib/hooks/use-inception";
import {
  daysSinceInception,
  daysUntilCalendarDate,
  describeDaysUntil,
  formatWeekdayDate,
} from "@/lib/portfolio";
import { CalendarClock } from "lucide-react";

/**
 * The live-book banner. Its job is provenance and cadence, nothing else.
 *
 * It used to also carry Days live, Positions and Picks return — the same
 * three figures the stat tiles directly beneath it showed, so the top of the
 * page said everything twice and the one number only this strip knew, the
 * next evaluation date, sat fourth in a row of duplicates with its
 * explanation hidden in a `title` tooltip no touch screen can open.
 *
 * Now: one sentence on the left (what this is, since when, day N), and on the
 * right the next evaluation with the countdown and the rule spelled out. A
 * holdings table that has not changed in ten days is the strategy doing its
 * job; without this line it looks like a strategy that stopped.
 */
export function LiveStatus() {
  const { data: strategy, isPending, isError } = useStrategy();
  const { inceptionISO } = useInceptionDate();
  const days = daysSinceInception(inceptionISO);
  const nextEvaluation = formatWeekdayDate(strategy?.next_evaluation_date);
  const untilNext = describeDaysUntil(
    daysUntilCalendarDate(strategy?.next_evaluation_date),
  );
  const cadence = strategy?.strategy?.evaluation_frequency ?? null;

  // A pulsing green "Live portfolio" banner full of em-dashes is worse than no
  // banner: it asserts everything is fine while the numbers are unavailable.
  // The page that owns this slot renders the real explanation instead.
  if (isError) return null;

  return (
    <div className="data-card">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
        <div className="flex items-start gap-3.5">
          {/* A slow opacity breathe, not `animate-ping`: the ring expanding
              every second was the most active thing on a page whose data
              changes twice a month. Stops entirely under reduced motion. */}
          <span
            className="op-live-glow mt-[5px] inline-flex h-2.5 w-2.5 shrink-0 rounded-full bg-accent-green"
            aria-hidden
          />
          <div className="min-w-0">
            <span className="panel-label panel-label-mint">Live portfolio</span>
            <p className="mt-1 font-sans text-[13px] text-text-muted">
              Real trades · Tracked since{" "}
              {new Date(`${inceptionISO}T00:00:00Z`).toLocaleDateString(
                "en-US",
                {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                  timeZone: "UTC",
                },
              )}{" "}
              ·{" "}
              <span className="font-mono tabular-nums text-text">
                Day {days}
              </span>
            </p>
          </div>
        </div>

        <div className="flex items-start gap-3 sm:items-center sm:text-right">
          <span
            className="inline-flex items-center justify-center rounded-lg bg-accent-mint/15 p-1.5 sm:order-2"
            aria-hidden
          >
            <CalendarClock size={13} strokeWidth={2} className="text-text-muted" />
          </span>
          <div className="min-w-0 sm:order-1">
            <span className="field-label block">Next evaluation</span>
            <p className="mt-0.5 font-mono text-[16px] font-bold leading-tight tabular-nums">
              {isPending ? (
                <span className="inline-block h-[18px] w-24 animate-pulse rounded bg-bg-tertiary align-middle" />
              ) : nextEvaluation ? (
                <>
                  {nextEvaluation}
                  {untilNext && (
                    <span className="ml-2 font-sans text-[12px] font-medium text-text-dim">
                      {untilNext}
                    </span>
                  )}
                </>
              ) : (
                "—"
              )}
            </p>
            <p className="mt-1 font-sans text-[11px] leading-snug text-text-dim">
              {cadence === "biweekly"
                ? "1st and 3rd Friday · at most one new name per cycle · holdings don't change in between"
                : "Holdings only change on evaluation days · at most one new name per cycle"}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
