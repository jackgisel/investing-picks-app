import Link from "next/link";
import { PRICING, FOUNDERS_DEAL_MAX_DAY } from "@/lib/constants";
import { FoundersPricingCallout } from "./founders-pricing-callout";

const features = [
  "New high-conviction research every 2 weeks",
  "Full portfolio with live BUY / HOLD / SELL status",
  "Performance tracking vs S&P 500",
  "Email and push alerts on new picks",
  "Complete research notes and investment thesis",
  "Full 5-year model backtest + live example portfolio",
  "Transparent track record — wins and losses included",
];

export function Pricing() {
  return (
    <section id="pricing" className="border-b border-border">
      <div className="container-op py-20">
        <p className="section-label">MEMBERSHIP</p>
        <h2 className="section-title">One plan. Full access. No upsells.</h2>
        <p className="section-sub">
          Join the research team. Every member gets the full portfolio, every
          note, and every update — nothing held back.
        </p>

        <FoundersPricingCallout />

        <div className="bg-bg-secondary border border-border max-w-[500px] mx-auto overflow-hidden">
          <div className="px-10 py-11 text-center border-b border-border">
            <p className="font-mono text-[10px] text-accent-green tracking-[2px] mb-3">
              FOUNDERS RATE · THROUGH DAY {FOUNDERS_DEAL_MAX_DAY}
            </p>
            <p className="font-mono text-[52px] font-bold text-accent-green">
              ${PRICING.foundersAnnual}
              <span className="font-sans text-base text-text-muted font-normal">
                {" "}
                / year
              </span>
            </p>
            <p className="font-sans text-[13px] text-text-dim mt-2 line-through">
              Standard {PRICING.label}
            </p>
            <p className="font-sans text-[13px] text-text-muted mt-3">
              Billed annually via Paddle. Cancel anytime. Founders pricing locks
              in for your first year when you join before Day{" "}
              {FOUNDERS_DEAL_MAX_DAY}.
            </p>
          </div>

          <div className="px-10">
            {features.map((feat, i) => (
              <div
                key={i}
                className={`flex items-center gap-3.5 py-4 font-sans text-[14px] text-text-muted ${
                  i < features.length - 1 ? "border-b border-border" : ""
                }`}
              >
                <span className="text-accent-green font-mono text-base font-bold">
                  +
                </span>
                {feat}
              </div>
            ))}
          </div>

          <div className="px-10 py-8">
            <Link
              href="/dashboard"
              className="btn-primary block text-center w-full"
            >
              START AT FOUNDERS RATE →
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
