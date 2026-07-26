import { FoundersPricingCallout } from "./founders-pricing-callout";
import { PricingPlanCard } from "./pricing-plan-card";

export function Pricing() {
  return (
    <section id="pricing" className="border-b border-border">
      <div className="container-op py-20 sm:py-24">
        <div className="max-w-[520px] mb-12">
          <p className="section-label section-label-mint">Membership</p>
          <h2 className="section-title">One plan. Full access. No upsells.</h2>
          <p className="section-sub mb-0">
            Every member gets the full portfolio, every note, and every update —
            nothing held back.
          </p>
        </div>

        <FoundersPricingCallout />

        <PricingPlanCard />
      </div>
    </section>
  );
}
