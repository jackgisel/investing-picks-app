"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  FOUNDERS_DEAL_MAX_DAY,
  PRICING,
} from "@/lib/constants";
import {
  daysSinceInception,
  foundersDealDaysRemaining,
  isFoundersDealActive,
} from "@/lib/portfolio";

export function FoundersBanner() {
  const pathname = usePathname();
  const day = daysSinceInception();
  const active = isFoundersDealActive(day);
  const remaining = foundersDealDaysRemaining(day);

  if (pathname.startsWith("/dashboard") || !active) return null;

  return (
    <div className="bg-accent-green text-black border-b border-accent-green-hover">
      <div className="container-op py-2.5 flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-3 text-center">
        <span className="font-mono text-[10px] sm:text-[11px] font-bold tracking-[2px] uppercase">
          Founders deal
        </span>
        <span className="font-sans text-[12px] sm:text-[13px] font-medium">
          {PRICING.foundersLabel} through Day {FOUNDERS_DEAL_MAX_DAY} of our
          live portfolio
          <span className="hidden sm:inline">
            {" "}
            · {remaining} day{remaining === 1 ? "" : "s"} left
          </span>
        </span>
        <Link
          href="/#pricing"
          className="font-mono text-[10px] font-semibold tracking-[1.5px] underline underline-offset-2 hover:opacity-80"
        >
          LOCK IN FOUNDERS RATE →
        </Link>
      </div>
    </div>
  );
}
