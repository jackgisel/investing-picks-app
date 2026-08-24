import type { Metadata } from "next";
import Link from "next/link";

import { FAQList } from "@/components/blog/prose";
import { MarketNoteSignup } from "@/components/marketing/market-note-signup";
import { PillButton } from "@/components/ui/pill-button";
import { FAQ_GROUPS, FAQ_ITEMS } from "@/content/faq";
import { SITE_NAME, SITE_URL } from "@/lib/constants";

export const metadata: Metadata = {
  title: "FAQ",
  description:
    "Straight answers about Outpick: how we invest, why we publish every exit, how performance is calculated, and what membership costs.",
  // The root layout sets a site-wide canonical, and Next merges rather than
  // replaces it — without this the page would declare the homepage as its
  // canonical URL and never rank on its own.
  alternates: { canonical: "/faq" },
};

/**
 * The FAQ, moved off the homepage.
 *
 * It was a full screen of accordion between the pricing band and the footer,
 * where it lengthened the page for everyone and was indexable by nobody. On its
 * own URL it carries FAQPage structured data, which is the only form of this
 * content search engines will surface directly.
 */
export default function FaqPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQ_ITEMS.map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: { "@type": "Answer", text: item.a },
    })),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <div className="container-op border-b border-border py-14 sm:py-16">
        <div className="max-w-[640px]">
          <p className="section-label">FAQ</p>
          <h1 className="section-title">Straight answers.</h1>
          <p className="section-sub mb-0">
            What {SITE_NAME} is, how we invest, and what you get for the money.
            If something here is missing,{" "}
            <a
              href="mailto:hello@outpick.xyz"
              className="font-semibold text-text underline underline-offset-2 hover:opacity-70"
            >
              ask us
            </a>
            .
          </p>
        </div>
      </div>

      <div className="container-op py-4 sm:py-6">
        <div className="max-w-[680px]">
          {FAQ_GROUPS.map((group) => (
            <FAQList
              key={group.title}
              title={group.title}
              items={group.items}
            />
          ))}

          <div className="mt-4 mb-16 flex flex-wrap items-center gap-4">
            <PillButton href="/pricing" arrow>
              See membership
            </PillButton>
            <Link
              href="/strategy"
              className="rounded-sm font-sans text-[12px] font-bold uppercase tracking-[0.1em] text-text-muted transition-colors hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
            >
              How we invest →
            </Link>
          </div>

          <div className="mb-16">
            <MarketNoteSignup source="faq" variant="panel" />
          </div>
        </div>
      </div>
    </>
  );
}
