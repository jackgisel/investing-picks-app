import Link from "next/link";
import { FOUNDERS_DEAL_MAX_DAY, PRICING } from "@/lib/constants";

export function FoundersPricingCallout() {
  return (
    <div className="max-w-[500px] mx-auto mb-8 border border-accent-green/40 bg-accent-green-soft/20 px-6 py-5 text-center">
      <p className="font-mono text-[10px] text-accent-green tracking-[2px] mb-2 uppercase">
        Founders deal · Day 1–{FOUNDERS_DEAL_MAX_DAY}
      </p>
      <p className="font-sans text-[15px] text-text leading-snug mb-1">
        <span className="font-bold text-accent-green">{PRICING.foundersLabel}</span>
        <span className="text-text-muted"> instead of </span>
        <span className="line-through text-text-dim">{PRICING.label}</span>
      </p>
      <p className="font-sans text-[12px] text-text-muted leading-relaxed">
        Early members lock in founders pricing through Day{" "}
        {FOUNDERS_DEAL_MAX_DAY} of our live example portfolio. Standard pricing
        applies after that window.
      </p>
      <Link
        href="/dashboard"
        className="inline-block mt-4 font-mono text-[11px] text-accent-green tracking-wider hover:underline"
      >
        START AT FOUNDERS RATE →
      </Link>
    </div>
  );
}
