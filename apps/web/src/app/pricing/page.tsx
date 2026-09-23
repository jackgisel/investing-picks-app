import type { Metadata } from "next";
import { PricingPageView } from "@/components/pricing/pricing-page";
import { pricingFaqJsonLd } from "@/content/pricing";
import {
  FOUNDERS_DEAL_ENDS_ISO,
  FOUNDERS_DEAL_ENDS_LABEL,
  PRICING,
  SITE_NAME,
  SITE_URL,
} from "@/lib/constants";
import { isFoundersWindowActive } from "@/lib/founders-server";

function pricingCopy(founders: boolean) {
  const title = founders
    ? `${PRICING.foundersLabel} for value-based stock research`
    : `${PRICING.label} for value-based stock research`;
  const description = founders
    ? `Outpick membership is ${PRICING.foundersLabel} through ${FOUNDERS_DEAL_ENDS_LABEL}, then ${PRICING.label}. One researched pick every two weeks, a live example portfolio, and the scoreboard vs the S&P 500. For investors who outgrew index funds — not a signal service.`
    : `Outpick membership is ${PRICING.label}, a flat fee. One researched pick every two weeks, a live example portfolio, and the scoreboard vs the S&P 500. For investors who outgrew index funds — not a signal service.`;
  return { title, description };
}

export async function generateMetadata(): Promise<Metadata> {
  const founders = await isFoundersWindowActive();
  const { title, description } = pricingCopy(founders);

  return {
    title,
    description,
    keywords: [
      "Outpick pricing",
      "stock research membership",
      "stock picking service cost",
      "is a stock research service worth it",
      "value investing research subscription",
    ],
    alternates: {
      canonical: "/pricing",
    },
    openGraph: {
      title: `${title} — ${SITE_NAME}`,
      description,
      url: `${SITE_URL}/pricing`,
    },
    twitter: {
      card: "summary_large_image",
      title: `${title} — ${SITE_NAME}`,
      description,
    },
  };
}

export default async function PricingPage() {
  const founders = await isFoundersWindowActive();
  const { description } = pricingCopy(founders);
  const offerPrice = founders ? PRICING.foundersAnnual : PRICING.annual;

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      pricingFaqJsonLd(),
      {
        "@type": "Offer",
        name: "Outpick annual membership",
        description,
        url: `${SITE_URL}/pricing`,
        price: String(offerPrice),
        priceCurrency: PRICING.currency,
        ...(founders ? { priceValidUntil: FOUNDERS_DEAL_ENDS_ISO } : {}),
        availability: "https://schema.org/InStock",
        category: "Subscription",
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <PricingPageView />
    </>
  );
}
