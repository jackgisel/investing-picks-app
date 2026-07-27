import type { Metadata } from "next";
import Link from "next/link";
import { CategoryTag } from "@/components/ui/category-tag";
import { type PastelTone } from "@/lib/tones";

export const metadata: Metadata = {
  title: "What we are not",
  description:
    "Outpick is an equity research firm. We do not time the market, call entry and exit prices, or send trade signals. Here is exactly what that means.",
};

/**
 * The negative space around the product.
 *
 * Almost everyone arriving here has met a stock newsletter first, so they
 * arrive with a template: alerts, price targets, "buy under $40", a call on
 * where the market goes next. Saying what we are does not dislodge that —
 * saying what we are NOT does, and it sets expectations we can actually keep.
 */
const NOT: {
  label: string;
  tone: PastelTone;
  title: string;
  body: string;
  instead: string;
}[] = [
  {
    label: "Not timing",
    tone: "coral",
    title: "We do not time the market",
    body: "We have no view on where the index goes next quarter, no cash-vs-equities call, and no opinion on whether now is a good moment to be invested. Nobody has demonstrated they can do this reliably, so we do not sell it.",
    instead:
      "We research individual businesses and judge each on its own economics.",
  },
  {
    label: "Not prices",
    tone: "peach",
    title: "We do not call entry and exit points on price",
    body: "No “buy under $40”, no price targets, no stop losses, no support and resistance. A price level is not a reason to own a company, and a thesis that only works below a number was never a thesis about the business.",
    instead:
      "Every position carries a written reason tied to the company's fundamentals, and we publish the rules that close it.",
  },
  {
    label: "Not signals",
    tone: "yellow",
    title: "We do not run an alert service",
    body: "Nothing here is designed to be traded the minute it appears. The book is re-evaluated on a fixed, published cadence — the 1st and 3rd Friday of each month — and there is no urgency premium for acting first.",
    instead:
      "You can read the research, disagree with it, and act on your own schedule. That is the intended use.",
  },
  {
    label: "Not advice",
    tone: "lilac",
    title: "We are not a broker or a registered adviser",
    body: "We do not know your circumstances, your tax position, or your risk tolerance, and we never tailor anything to them. We hold no client money and execute nothing on your behalf.",
    instead:
      "We publish research. What you do with it is your decision and your responsibility.",
  },
];

export default function WhatWeAreNotPage() {
  return (
    <div className="container-op py-20 sm:py-24">
      <div className="max-w-[680px]">
        <p className="section-label section-label-coral">What we are not</p>
        <h1 className="section-title">
          Most of what people expect from a stock site, we don&apos;t do.
        </h1>
        <p className="section-sub">
          Outpick is a research firm. We find value-based investments in
          US-listed businesses, write up what we find, and publish the results
          in the open — the wins and the losses. Four things we are regularly
          assumed to be, and are not.
        </p>
      </div>

      <div className="mt-14 sm:mt-16 grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-12 max-w-[980px]">
        {NOT.map((n) => (
          <div key={n.title}>
            <CategoryTag tone={n.tone} className="mb-4">
              {n.label}
            </CategoryTag>
            <h2 className="font-sans text-[17px] sm:text-[18px] font-bold mb-2.5 tracking-tight">
              {n.title}
            </h2>
            <p className="font-sans text-[15px] text-text-muted leading-relaxed">
              {n.body}
            </p>
            <p className="mt-3 border-l-2 border-accent-green-soft pl-4 font-sans text-[14px] text-text leading-relaxed">
              {n.instead}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-16 sm:mt-20 max-w-[680px] border-t border-border pt-10">
        <h2 className="font-sans text-[19px] font-bold mb-3 tracking-tight">
          What we actually do
        </h2>
        <p className="font-sans text-[15px] text-text-muted leading-relaxed">
          We score US-listed companies on five fundamental factors — valuation,
          growth, profitability, momentum and estimate revisions — each measured
          against the company&apos;s own sector rather than the whole market. The
          model was tested on data it had never seen before we put a dollar
          behind it. The resulting book is public: every open position, every
          closed one, the reasoning attached to each, and the rules that decide
          when something is sold.
        </p>
        <p className="mt-4 font-sans text-[15px] text-text-muted leading-relaxed">
          If you are looking for someone to tell you what to buy this morning
          and at what price, we are the wrong publication, and we would rather
          you found that out here than after paying us.
        </p>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/#strategy" className="btn-primary">
            How the method works
          </Link>
          <Link href="/#pricing" className="btn-outline">
            See membership
          </Link>
        </div>
      </div>
    </div>
  );
}
