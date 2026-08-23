"use client";

import { WINNERS_CIRCLE } from "@/lib/constants";
import { CompanyLogo } from "@/components/ui/company-logo";
import { cn } from "@/lib/utils";

/**
 * Closed winners orbiting the hero art — logo + return. Positions sit in the
 * right half around the astronaut without covering the reading column.
 */
const BUBBLES = [
  {
    ...WINNERS_CIRCLE[0],
    className: "top-[10%] right-[10%] hero-float",
  },
  {
    ...WINNERS_CIRCLE[4],
    className: "top-[28%] right-[1%] hero-float hero-float-delay-1",
  },
  {
    ...WINNERS_CIRCLE[1],
    className: "top-[48%] right-[8%] hero-float hero-float-delay-2",
  },
  {
    ...WINNERS_CIRCLE[2],
    className: "bottom-[30%] right-[28%] hero-float hero-float-delay-3",
  },
  {
    ...WINNERS_CIRCLE[3],
    className: "bottom-[14%] right-[4%] hero-float hero-float-delay-4",
  },
] as const;

export function HeroPickBubbles() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-y-0 right-0 hidden w-[55%] lg:block"
    >
      {BUBBLES.map((b) => (
        <div
          key={b.ticker}
          className={cn(
            "absolute flex items-center gap-2.5 rounded-full border border-border/80 bg-bg/85 px-3 py-2 shadow-[0_8px_28px_rgba(0,0,0,0.18)] backdrop-blur-md dark:bg-bg/80",
            b.className,
          )}
        >
          <CompanyLogo ticker={b.ticker} size="sm" />
          <div className="pr-0.5">
            <p className="font-sans text-[11px] font-bold tracking-wide text-text">
              {b.ticker}
            </p>
            <p className="font-sans text-[12px] font-semibold tabular-nums text-accent-green leading-none mt-0.5">
              {b.ret}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
