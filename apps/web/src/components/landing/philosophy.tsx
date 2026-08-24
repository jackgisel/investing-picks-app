import Link from "next/link";
import { PillButton } from "@/components/ui/pill-button";

/**
 * What we believe, in one section.
 *
 * Replaces three that were arguing the same case in sequence — "who we are",
 * "why we exist" and "our strategy" ran to 458 lines between them and a reader
 * scrolling past got the transparency argument three times. The long version
 * lives on /strategy now; this is the part that has to land above the fold.
 */

const BELIEFS: { num: string; title: string; body: string }[] = [
  {
    num: "01",
    title: "We buy businesses, not tickers",
    body: "Durable economics first — margins that survive a bad year, cash flow that funds itself, and a competitive position that is hard to copy. A ticker is a claim on a business; if we cannot explain the business, we do not own the claim.",
  },
  {
    num: "02",
    title: "A long horizon, by default",
    body: "We underwrite a company over years, not quarters. That is a research discipline before it is a holding period: a thesis that only works if the next earnings print cooperates is not a thesis.",
  },
  {
    num: "03",
    title: "Investing, not trading",
    body: "We research what to own. We publish no entry and exit prices, no chart setups, and nothing you are meant to act on within the hour. Buying a business and trading a pattern are different activities, not the same one at different speeds.",
  },
  {
    num: "04",
    title: "The losses stay on the page",
    body: "Every position that went against us stays published, with a note explaining what we got wrong. A record with the losses edited out is a marketing asset, not a record.",
  },
];

export function Philosophy() {
  return (
    <section id="strategy" className="border-b border-border">
      <div className="container-op py-16 sm:py-20">
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:gap-16">
          <div className="max-w-[460px] lg:sticky lg:top-[calc(var(--nav-h)+2rem)] lg:self-start">
            <p className="section-label">What we believe</p>
            <h2 className="section-title">
              Value investing, with the work shown.
            </h2>
            <p className="section-sub">
              None of this is original and we would be suspicious of a firm
              claiming otherwise. It is value investing as Graham set it out and
              Buffett spent sixty years refining in public — a good business,
              bought for less than it is worth, held long enough to matter.
            </p>
            <p className="section-sub">
              What is new is the tooling, not the philosophy. We can hold 3,600
              companies to the same standard every two weeks. The standard is
              the old one.
            </p>
            <div className="flex flex-wrap items-center gap-4">
              <PillButton href="/strategy" arrow>
                How we invest
              </PillButton>
              <Link
                href="/faq"
                className="rounded-sm font-sans text-[12px] font-bold uppercase tracking-[0.1em] text-text-muted transition-colors hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text focus-visible:ring-offset-2"
              >
                Common questions →
              </Link>
            </div>
          </div>

          <ol className="divide-y divide-border border-y border-border">
            {BELIEFS.map((belief) => (
              <li key={belief.num} className="py-7 sm:py-8">
                <div className="flex items-baseline gap-4">
                  <span className="font-mono text-[12px] font-bold tracking-wider text-text-dim">
                    {belief.num}
                  </span>
                  <h3 className="font-sans text-[18px] font-bold leading-snug tracking-tight sm:text-[19px]">
                    {belief.title}
                  </h3>
                </div>
                <p className="mt-2.5 pl-8 font-sans text-[15px] leading-relaxed text-text-muted">
                  {belief.body}
                </p>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
