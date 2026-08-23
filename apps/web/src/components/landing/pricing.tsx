import Link from "next/link";
import { PillButton } from "@/components/ui/pill-button";
import { PriceLine } from "./price-line";

/**
 * Compact membership band on the landing page. Full offer lives on /pricing
 * so the buyer can see price + deliverables in one viewport.
 */
export function Pricing() {
  return (
    <section id="pricing" className="border-b border-border">
      <div className="container-op py-14 sm:py-16">
        <div className="flex flex-col gap-8 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-[480px]">
            <p className="section-label">Membership</p>
            <h2 className="section-title text-[28px] sm:text-[32px]">
              One plan. Everything included.
            </h2>
            <p className="section-sub mb-0">
              Research every two weeks, the live book, and the scoreboard vs the
              S&amp;P — no tiers, no upsells.
            </p>
          </div>
          <div className="flex flex-col items-start gap-3 sm:items-end">
            <PillButton href="/pricing" arrow>
              See pricing
            </PillButton>
            <PriceLine />
            <Link
              href="/pricing"
              className="font-sans text-[12px] font-bold tracking-[0.1em] uppercase text-text-muted transition-colors hover:text-text"
            >
              What you get →
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
