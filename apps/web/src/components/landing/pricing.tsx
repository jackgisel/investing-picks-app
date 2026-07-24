import { PRICING, FOUNDERS_DEAL_MAX_DAY } from "@/lib/constants";
import { FoundersPricingCallout } from "./founders-pricing-callout";
import { PillButton } from "@/components/ui/pill-button";

const features = [
  "New high-conviction research every 2 weeks",
  "Full portfolio with live BUY / HOLD / SELL status",
  "Performance tracking vs S&P 500",
  "Email alerts on new picks",
  "Complete research notes and investment thesis",
  "5-year model backtest + live example portfolio",
  "Transparent track record — wins and losses",
];

export function Pricing() {
  return (
    <section id="pricing" className="border-b border-border">
      <div className="container-op py-20 sm:py-24">
        <div className="max-w-[520px] mb-12">
          <p className="section-label">Membership</p>
          <h2 className="section-title">One plan. Full access. No upsells.</h2>
          <p className="section-sub mb-0">
            Every member gets the full portfolio, every note, and every update —
            nothing held back.
          </p>
        </div>

        <FoundersPricingCallout />

        <div className="max-w-[520px] border border-border-strong rounded-soft overflow-hidden bg-bg">
          <div className="px-8 sm:px-10 py-10 border-b border-border">
            <p className="font-sans text-[11px] font-bold tracking-[0.16em] uppercase text-text-dim mb-5">
              Founders rate · through Day {FOUNDERS_DEAL_MAX_DAY}
            </p>
            <p className="font-mono text-[56px] font-bold text-text leading-none tracking-tight">
              ${PRICING.foundersAnnual}
              <span className="font-sans text-base text-text-muted font-medium tracking-normal">
                {" "}
                / year
              </span>
            </p>
            <p className="font-sans text-[13px] text-text-dim mt-3">
              Standard {PRICING.label} after founders window
            </p>
            <p className="font-sans text-[14px] text-text-muted mt-5 leading-relaxed">
              Billed annually via Paddle. Cancel anytime. Lock in founders
              pricing for your first year when you join before Day{" "}
              {FOUNDERS_DEAL_MAX_DAY}.
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
                  className="mt-0.5 w-1.5 h-1.5 rounded-full bg-accent-mint shrink-0"
                  aria-hidden
                />
                {feat}
              </li>
            ))}
          </ul>

          <div className="px-8 sm:px-10 py-8">
            <PillButton href="/dashboard" arrow className="w-full">
              Start at founders rate
            </PillButton>
          </div>
        </div>
      </div>
    </section>
  );
}
