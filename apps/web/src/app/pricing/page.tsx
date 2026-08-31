import type { Metadata } from "next";
import { PricingPageView } from "@/components/pricing/pricing-page";
import { PRICING, SITE_NAME } from "@/lib/constants";

// Explicit: do not fall back to a year-long static prerender of pricing copy.
export const revalidate = 60;

export const metadata: Metadata = {
  title: "Pricing",
  description: `Outpick membership: ${PRICING.foundersLabel} founding year, then ${PRICING.label}. Full research, live example portfolio, and performance vs the S&P 500 — one plan, no upsells.`,
  alternates: {
    canonical: "/pricing",
  },
  openGraph: {
    title: `Pricing — ${SITE_NAME}`,
    description:
      "One plan. Full access. Research every two weeks, the live book, and the scoreboard vs the S&P 500.",
  },
};

export default function PricingPage() {
  return <PricingPageView />;
}
