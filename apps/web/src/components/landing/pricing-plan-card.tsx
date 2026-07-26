"use client";

import { BACKTEST, FOUNDERS_DEAL_MAX_DAY, PRICING } from "@/lib/constants";
import { PillButton } from "@/components/ui/pill-button";
import { TONE_BG, toneByIndex } from "@/lib/tones";
import { daysSinceInception, isFoundersDealActive } from "@/lib/portfolio";

const features = [
  "New high-conviction research every 2 weeks",
  "Full portfolio with live BUY / HOLD / SELL status",
  "Performance tracking vs S&P 500",
  "Email alerts on new picks",
  "Complete research notes and investment thesis",
  `${BACKTEST.yearsCovered}-year model backtest + live example portfolio`,
  "Transparent track record — wins and losses",
];

/**
 * The plan card. Client-side because the headline price depends on whether the
 * founders window is still open — same reason FoundersBanner is a client
 * component, and the two must agree: it is not defensible to drop the banner
 * on Day 151 and keep selling the founders rate on the same page.
 */
export function PricingPlanCard() {
  const active = isFoundersDealActive(daysSinceInception());

  return (
    <div className="max-w-[520px] mx-auto border border-border-strong rounded-soft overflow-hidden bg-bg">
      <div className="px-8 sm:px-10 py-10 border-b border-border">
        <p className="font-sans text-[11px] font-bold tracking-[0.16em] uppercase text-text-dim mb-5">
          {active ? (
            <>Founders rate · through Day {FOUNDERS_DEAL_MAX_DAY}</>
          ) : (
            <>Membership · billed annually</>
          )}
        </p>
        <p className="font-mono text-[56px] font-bold text-text leading-none tracking-tight">
          ${active ? PRICING.foundersAnnual : PRICING.annual}
          <span className="font-sans text-base text-text-muted font-medium tracking-normal">
            {" "}
            / year
          </span>
        </p>
        {active && (
          <p className="font-sans text-[13px] text-text-dim mt-3">
            Standard {PRICING.label} after founders window
          </p>
        )}
        <p className="font-sans text-[14px] text-text-muted mt-5 leading-relaxed">
          Billed annually via Paddle. Cancel anytime.
          {active && (
            <>
              {" "}
              Lock in founders pricing for your first year when you join before
              Day {FOUNDERS_DEAL_MAX_DAY}.
            </>
          )}
        </p>
      </div>

      <ul className="px-8 sm:px-10">
        {features.map((feat, i) => (
          <li
            key={feat}
            className={`flex items-start gap-3.5 py-4 font-sans text-[14px] text-text-muted ${
              i < features.length - 1 ? "border-b border-border" : ""
            }`}
          >
            <span
              className={`mt-0.5 w-2 h-2 rounded-full shrink-0 ${
                TONE_BG[toneByIndex(i)]
              }`}
              aria-hidden
            />
            {feat}
          </li>
        ))}
      </ul>

      <div className="px-8 sm:px-10 py-8">
        <PillButton href="/dashboard" arrow className="w-full">
          {active ? "Start at founders rate" : "Start membership"}
        </PillButton>
      </div>
    </div>
  );
}
