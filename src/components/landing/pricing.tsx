import Link from "next/link";
import { PRICING, BACKTEST } from "@/lib/constants";

const features = [
  "New high-conviction pick every 2 weeks",
  "Full portfolio with live BUY / HOLD / SELL status",
  "Performance tracking vs S&P 500",
  "Email and push alerts on new picks",
  "Complete research notes and investment thesis",
  "Full strategy backtest + live portfolio data",
  `${BACKTEST.winnersCircle} stocks that doubled in the backtest`,
];

export function Pricing() {
  return (
    <section id="pricing" className="border-b border-border">
      <div className="container-op py-20">
        <p className="section-label">MEMBERSHIP</p>
        <h2 className="section-title">One plan. Full access.</h2>
        <p className="section-sub">
          No tiers, no upsells. Every member gets everything.
        </p>

        <div className="bg-bg-secondary border border-border max-w-[500px] mx-auto overflow-hidden">
          <div className="px-10 py-11 text-center border-b border-border">
            <p className="font-mono text-[52px] font-bold">
              ${PRICING.annual.toLocaleString()}
              <span className="font-sans text-base text-text-muted font-normal">
                {" "}
                / year
              </span>
            </p>
            <p className="font-sans text-[13px] text-text-muted mt-2">
              Billed annually via Paddle. Cancel anytime.
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
              START YOUR MEMBERSHIP →
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
