"use client";

import { PRICING } from "@/lib/constants";
import { isFoundersDealActive } from "@/lib/portfolio";

/**
 * The one-line price under a CTA. Client-side so it stops naming the founders
 * rate the moment the window closes — see PricingPlanCard.
 */
export function PriceLine({ className = "" }: { className?: string }) {
  const active = isFoundersDealActive();

  return (
    <p className={`font-sans text-[13px] text-text-dim ${className}`}>
      {active ? (
        <>
          Founders: <span className="font-mono">{PRICING.foundersLabel}</span>{" "}
          · then <span className="font-mono">{PRICING.label}</span> · plus tax
        </>
      ) : (
        <>
          <span className="font-mono">{PRICING.label}</span> · billed
          annually · plus applicable taxes
        </>
      )}
    </p>
  );
}
