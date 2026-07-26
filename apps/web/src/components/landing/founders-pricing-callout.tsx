"use client";

import { FOUNDERS_DEAL_MAX_DAY, PRICING } from "@/lib/constants";
import { PillButton } from "@/components/ui/pill-button";
import { daysSinceInception, isFoundersDealActive } from "@/lib/portfolio";

export function FoundersPricingCallout() {
  // Mirrors FoundersBanner — once the window closes, nothing on the page may
  // keep advertising the founders rate.
  if (!isFoundersDealActive(daysSinceInception())) return null;

  return (
    <div className="max-w-[520px] mx-auto mb-8 soft-card text-center !py-6">
      <p className="font-sans text-[11px] font-bold tracking-[0.14em] uppercase text-text mb-2">
        Founders deal · Day 1–{FOUNDERS_DEAL_MAX_DAY}
      </p>
      <p className="font-sans text-[16px] text-text leading-snug mb-1">
        <span className="font-bold">{PRICING.foundersLabel}</span>
        <span className="text-text-muted"> instead of </span>
        <span className="line-through text-text-dim">{PRICING.label}</span>
      </p>
      <p className="font-sans text-[13px] text-text-muted leading-relaxed mb-4">
        Early members lock in founders pricing through Day{" "}
        {FOUNDERS_DEAL_MAX_DAY} of our live example portfolio.
      </p>
      <PillButton href="/dashboard" variant="outline" arrow className="text-[11px]">
        Start at founders rate
      </PillButton>
    </div>
  );
}
