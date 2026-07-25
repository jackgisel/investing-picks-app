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
    <div className="bg-inverse text-inverse-fg">
      <div className="container-op py-2.5 flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-3 text-center">
        <span className="font-sans text-[11px] sm:text-[12px] font-medium">
          Founders deal — {PRICING.foundersLabel} through Day{" "}
          {FOUNDERS_DEAL_MAX_DAY}
          <span className="hidden sm:inline">
            {" "}
            · {remaining} day{remaining === 1 ? "" : "s"} left
          </span>
        </span>
        <Link
          href="/#pricing"
          className="font-sans text-[11px] font-bold tracking-[0.08em] uppercase underline underline-offset-2 hover:opacity-80"
        >
          Lock in founders rate →
        </Link>
      </div>
    </div>
  );
}
