"use client";

import { MEMBERSHIP_BENEFITS, PRICING } from "@/lib/constants";
import { PillButton } from "@/components/ui/pill-button";
import { isFoundersDealActive } from "@/lib/portfolio";

const features = MEMBERSHIP_BENEFITS;

/**
 * The plan card — the single place founding-member pricing is advertised.
 * There used to be a sticky countdown banner and a separate strikethrough
 * promo card too; both implied an expiring discount, which reads exactly
 * like the tiered-upsell newsletter pattern this product's own copy
 * disavows elsewhere ("One plan. Full access. No upsells."). This is framed
 * as membership cohort pricing instead — founding members get a rate for
 * their first year, full stop, no clock.
 */
export function PricingPlanCard() {
  const active = isFoundersDealActive();

  return (
    <div className="max-w-[520px] mx-auto border border-border-strong rounded-soft overflow-hidden bg-bg">
      <div className="px-8 sm:px-10 py-10 border-b border-border">
        <p className="font-sans text-[11px] font-bold tracking-[0.16em] uppercase text-text-dim mb-5">
          {active ? <>Founding member pricing</> : <>Membership · billed annually</>}
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
            Then {PRICING.label} from your second year
          </p>
        )}
        <p className="font-sans text-[14px] text-text-muted mt-5 leading-relaxed">
          Billed annually via Stripe, plus applicable taxes. Cancel anytime.
          {active && (
            <> Founding members lock in this rate for their first year — one price, no upsells.</>
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
              className="mt-0.5 w-2 h-2 rounded-full shrink-0 bg-border-strong"
              aria-hidden
            />
            {feat}
          </li>
        ))}
      </ul>

      <div className="px-8 sm:px-10 py-8">
        <PillButton href="/subscribe" arrow className="w-full">
          {active ? "Start at founders rate" : "Start membership"}
        </PillButton>
      </div>
    </div>
  );
}
