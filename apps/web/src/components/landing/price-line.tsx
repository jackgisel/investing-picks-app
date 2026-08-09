"use client";

import { PRICING } from "@/lib/constants";
import { daysSinceInception, isFoundersDealActive } from "@/lib/portfolio";

/**
 * The one-line price under a CTA. Client-side so it stops naming the founders
 * rate the moment the window closes — see PricingPlanCard.
 */
export function PriceLine({ className = "" }: { className?: string }) {
  const active = isFoundersDealActive(daysSinceInception());

  return (
    <p className={`font-sans text-[13px] text-text-dim ${className}`}>
      {active ? (
        <>
          Founders: {PRICING.foundersLabel} · then {PRICING.label} · plus tax
        </>
      ) : (
        <>{PRICING.label} · billed annually · plus applicable taxes</>
      )}
    </p>
  );
}
