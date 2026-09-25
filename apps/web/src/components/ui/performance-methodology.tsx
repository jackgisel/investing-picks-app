"use client";

import { useEffect, useId, useRef, useState } from "react";
import { CircleHelp } from "lucide-react";
import { formatChartDate } from "@/components/ui/picks-benchmark-chart";

/**
 * How the picks return and its S&P 500 comparison are calculated.
 *
 * This is the long form of `BenchmarkBasisNote`, and every figure that sets
 * the picks beside the S&P should be one click from it. A bare "S&P 500
 * +12%" invites the reader to assume the index's own move since some date,
 * which is a different and much weaker claim than the one we make.
 *
 * Keep the copy in step with `app/services/benchmarks.py`. Every sentence here
 * describes something that code does: picks entered on their own date,
 * closed picks frozen at their proceeds, SPY bought with the same dollars at
 * that day's close and left invested after the pick is sold, and windows
 * re-entered at their opening value.
 *
 * Spans, not paragraphs: the popover can sit inside a `<p>`.
 */
export function MethodologyCopy({
  inceptionDate,
  latestDate,
}: {
  inceptionDate?: string | null;
  latestDate?: string | null;
}) {
  const since = inceptionDate
    ? `from the first pick on ${formatChartDate(inceptionDate)}`
    : "from the first pick";
  return (
    <span className="block space-y-2.5 font-sans text-[12.5px] leading-relaxed text-text-muted">
      <span className="block">
        Outpick performance is calculated {since}. Each pick is bought on its
        pick date at that day&rsquo;s price. Sold picks stay in the record at
        what they sold for, so a closed loser never drops out. Idle cash is
        left out: the return is on the money actually put into picks.
      </span>
      <span className="block">
        The S&amp;P 500 uses the same money on the same dates. Every time a pick
        is bought, the same dollar amount of SPY is bought at that day&rsquo;s
        close. When a pick is sold, its proceeds sit in cash while the matching
        SPY stays invested.
      </span>
      <span className="block">
        Shorter ranges re-enter every open pick, and its SPY, at their value on
        the range&rsquo;s first day, so both lines start at 0%. Both sides are
        price returns; dividends are not added to either.
        {latestDate ? ` Returns are as of ${formatChartDate(latestDate)}.` : ""}
      </span>
    </span>
  );
}

/**
 * A "?" beside a return figure that opens `MethodologyCopy`.
 *
 * Hover opens it on a pointer device; click or tap toggles it everywhere, so
 * it works on touch without a hover state. Escape and an outside click close
 * it. Below `sm` the panel is a sheet pinned to the bottom of the viewport:
 * an anchored panel beside an icon halfway across a phone has nowhere to go
 * but off the edge. From `sm` up it hangs off the icon.
 */
export function PerformanceMethodology({
  inceptionDate,
  latestDate,
  align = "start",
  className = "",
}: {
  inceptionDate?: string | null;
  latestDate?: string | null;
  /** Which edge of the icon the panel lines up with. */
  align?: "start" | "end";
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [pinned, setPinned] = useState(false);
  const rootRef = useRef<HTMLSpanElement>(null);
  const panelId = useId();

  useEffect(() => {
    if (!open) return;
    const close = () => {
      setOpen(false);
      setPinned(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    const onPointer = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) close();
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [open]);

  return (
    <span
      ref={rootRef}
      className={`relative inline-flex ${className}`}
      onPointerEnter={(e) => {
        if (e.pointerType === "mouse") setOpen(true);
      }}
      onPointerLeave={(e) => {
        if (e.pointerType === "mouse" && !pinned) setOpen(false);
      }}
    >
      <button
        type="button"
        aria-label="How performance is calculated"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => {
          // A click after hover-open pins it rather than closing it — the
          // reader clicked because they want it to stay.
          if (open && !pinned) {
            setPinned(true);
            return;
          }
          setOpen(!open);
          setPinned(!open);
        }}
        className="inline-flex h-5 w-5 items-center justify-center rounded-full text-text-dim transition-colors hover:text-text focus-visible:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-strong"
      >
        <CircleHelp className="h-4 w-4" strokeWidth={2} aria-hidden />
      </button>
      {open && (
        <span
          id={panelId}
          role="dialog"
          aria-label="Calculating performance"
          className={`fixed inset-x-4 bottom-4 z-50 block max-sm:max-h-[70dvh] max-sm:overflow-y-auto rounded-xl border border-border bg-bg p-4 text-left font-normal normal-case tracking-normal shadow-lg sm:absolute sm:inset-x-auto sm:bottom-auto sm:top-[calc(100%+0.5rem)] sm:w-[26rem] sm:before:absolute sm:before:inset-x-0 sm:before:-top-2 sm:before:h-2 sm:before:content-[''] sm:p-5 ${
            align === "end" ? "sm:right-0" : "sm:left-0"
          }`}
        >
          <span className="mb-2 block font-sans text-[14px] font-bold text-text">
            Calculating performance
          </span>
          <MethodologyCopy
            inceptionDate={inceptionDate}
            latestDate={latestDate}
          />
        </span>
      )}
    </span>
  );
}
