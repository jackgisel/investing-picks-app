"use client";

import { PRICING } from "@/lib/constants";
import { isFoundersDealActive } from "@/lib/portfolio";

/**
 * The one-line price under a CTA. Client-side so it switches off the founders
 * rate the moment the window closes — see /pricing.
 *
 * Hero copy keeps this short: current price + the contrast with AUM-style % fees.
 * The full founders → year-two story lives on /pricing.
 */
export function PriceLine({ className = "" }: { className?: string }) {
  const active = isFoundersDealActive();
  const price = active ? PRICING.foundersLabel : PRICING.label;

  return (
    <p className={`font-sans text-[13px] text-text-dim ${className}`}>
      {price} · flat fee, no % of assets
    </p>
  );
}
