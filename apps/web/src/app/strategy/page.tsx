import type { Metadata } from "next";
import Link from "next/link";

import { Quote } from "@/components/blog/prose";
import { ComparisonTable } from "@/components/marketing/comparison-table";
import { MarketNoteSignup } from "@/components/marketing/market-note-signup";
import { PillButton } from "@/components/ui/pill-button";
import { SITE_NAME } from "@/lib/constants";

export const metadata: Metadata = {
  title: "How we invest",
  description:
    "Value-based equity research with a long horizon: what we look for in a business, how the five-factor model scores it, and the rules that close a position.",
  alternates: { canonical: "/strategy" },
};

/**
 * The deep page behind the homepage's philosophy section.
 *
 * Absorbs three sections the homepage used to carry separately — the strategy
 * pillars, the "where we sit" comparison, and the methodology paragraph that
 * was stranded at the bottom of /what-we-are-not. They were all arguing the
 * same case in three places above the fold; here they argue it once, at length,
 * for the reader who actually wants it.
 */

const PILLARS: { num: string; short: string; title: string; body: string }[] = [
  {
    num: "01",
    short: "Businesses",
    title: "We buy businesses, not tickers",
    body: "Every position starts with durable economics — margins that survive a bad year, cash flow that funds the business without the capital markets, a balance sheet that does not force a decision at the worst possible moment, and a competitive position that is hard to copy. A ticker is a claim on a business. If we cannot explain the business, we do not own the claim.",
  },
  {
    num: "02",
    short: "Horizon",
    title: "A long horizon, by default",
    body: "We underwrite a company over years. That is a research discipline before it is a holding period: a thesis that only works if the next quarter cooperates is not a thesis, it is a bet on a print. Owning a business for years also means most of what happens to the price in between is noise we are deliberately not reacting to.",
  },
  {
    num: "03",
    short: "Evidence",
    title: "Fundamentals, with the evidence attached",
    body: "We score roughly 3,600 US-listed companies on five fundamental factors — valuation, growth, profitability, momentum and estimate revisions — each measured against the company's own sector rather than the whole market. A cheap software company and a cheap miner are not the same claim, and scoring them on one scale would say they were.",
  },
  {
    num: "04",
    short: "Guardrails",
    title: "Conviction, with guardrails",
    body: "Concentration is where the return comes from and also where the ruin comes from. Position sizing, sector limits and drawdown rules are fixed in advance so that a single idea cannot undo years of research, and so that the decision to sell is made by a rule written on a calm day rather than by a person having a bad one.",
  },
];

export default function StrategyPage() {
  return (
    <>
      <div className="container-op border-b border-border py-14 sm:py-16">
        <div className="max-w-[680px]">
          <p className="section-label">How we invest</p>
          <h1 className="section-title">
            Value investing, researched in the open.
          </h1>
          <p className="section-sub mb-0">
            {SITE_NAME} is a research firm. We look for good businesses trading
            for less than they are worth, we underwrite them over years, and we
            publish the reasoning — including the positions that went against
            us.
          </p>
        </div>
      </div>

      {/* Investing vs trading. Stated first because it is the single most
          common wrong expectation a visitor arrives with. */}
      <section className="border-b border-border">
        <div className="container-op py-16 sm:py-20">
          <div className="grid grid-cols-1 gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16">
            <div className="max-w-[560px]">
              <p className="section-label section-label-yellow">
                Investing, not trading
              </p>
              <h2 className="section-title text-[28px] sm:text-[34px]">
                We research what to own, not what to trade.
              </h2>
              <p className="section-sub">
                Buying a business and waiting for it to grow, and buying a chart
                pattern and selling it inside a day, are not the same activity
                at different speeds. They are different activities, with
                different skills, different risks, and very different success
                rates.
              </p>
              <p className="section-sub mb-0">
                Everything we publish serves the first one. There are no entry
                and exit prices, no chart setups, no options overlays, and
                nothing you are meant to act on within the hour.
              </p>
            </div>

            <div className="rounded-soft border border-border bg-bg-secondary/30 px-6 py-7 sm:px-8">
              <p className="font-sans text-[11px] font-bold uppercase tracking-[0.14em] text-text-dim">
                What that rules out
              </p>
              <ul className="mt-5 space-y-3.5">
                {[
                  "Market timing and index forecasts",
                  "Price-based entry and exit points",
                  "Trade alerts you act on immediately",
                  "Options, leverage, and short-term setups",
                  "Personal advice — we are not a broker or adviser",
                ].map((item) => (
                  <li
                    key={item}
                    className="flex items-start gap-3 font-sans text-[15px] leading-relaxed text-text-muted"
                  >
                    <span
                      aria-hidden
                      className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-accent-coral"
                    />
                    {item}
                  </li>
                ))}
              </ul>
              <Link
                href="/what-we-are-not"
                className="mt-7 inline-flex rounded-sm font-sans text-[14px] font-semibold text-text underline underline-offset-4 transition-opacity hover:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text focus-visible:ring-offset-2"
              >
                What we do instead →
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Lineage. Influence, stated as influence — no association implied. */}
      <section className="border-b border-border">
        <div className="container-op py-16 sm:py-20">
          <div className="max-w-[680px]">
            <p className="section-label section-label-mint">Where this comes from</p>
            <h2 className="section-title text-[28px] sm:text-[34px]">
              An old idea, run with modern tooling.
            </h2>
            <p className="section-sub">
              None of the thinking here is original, and we would be suspicious
              of a firm that claimed otherwise. The framework is value
              investing as Benjamin Graham set it out and Warren Buffett spent
              sixty years refining in public: buy a business you understand, pay
              less than it is worth, insist on a margin of safety, and let time
              rather than activity do the compounding.
            </p>

            <Quote cite="Warren Buffett">
              Our favorite holding period is forever.
            </Quote>

            <p className="section-sub">
              What is different is the tooling, not the philosophy. We can score
              3,600 companies on the same criteria every two weeks and hold each
              one to the same standard, which is not something a person reading
              annual reports can do consistently. The machine narrows the field;
              the standard it narrows against is the old one.
            </p>
            <p className="section-sub mb-0">
              We have no association with Mr. Buffett or Berkshire Hathaway, and
              nothing here is endorsed by them. We are describing an influence,
              which is a different thing from a credential.
            </p>
          </div>
        </div>
      </section>

      {/* The four pillars. */}
      <section className="border-b border-border">
        <div className="container-op py-16 sm:py-20">
          <div className="mb-12 max-w-[560px] sm:mb-14">
            <p className="section-label">The framework</p>
            <h2 className="section-title text-[28px] sm:text-[34px]">
              Four things that do not change.
            </h2>
          </div>

          <ol className="divide-y divide-border border-y border-border">
            {PILLARS.map((pillar) => (
              <li
                key={pillar.num}
                className="grid grid-cols-1 items-start gap-4 border-l-2 border-border py-7 pl-5 sm:grid-cols-[56px_minmax(0,180px)_minmax(0,1fr)] sm:gap-8 sm:py-8 sm:pl-6"
              >
                <span className="pt-1 font-mono text-[12px] font-bold tracking-wider text-text-dim">
                  {pillar.num}
                </span>
                <div>
                  <span className="font-sans text-[11px] font-bold uppercase tracking-[0.12em] text-text-dim">
                    {pillar.short}
                  </span>
                  <h3 className="mt-3 font-sans text-[17px] font-bold tracking-tight sm:hidden">
                    {pillar.title}
                  </h3>
                </div>
                <div className="sm:pt-0.5">
                  <h3 className="mb-2 hidden font-sans text-[17px] font-bold tracking-tight sm:block">
                    {pillar.title}
                  </h3>
                  <p className="font-sans text-[15px] leading-relaxed text-text-muted">
                    {pillar.body}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* The loop, including the part most publications leave out. */}
      <section className="border-b border-border">
        <div className="container-op py-16 sm:py-20">
          <div className="max-w-[680px]">
            <p className="section-label section-label-lilac">In practice</p>
            <h2 className="section-title text-[28px] sm:text-[34px]">
              One name every two weeks, and a note when it closes.
            </h2>
            <p className="section-sub">
              The universe is rescored on a fixed cadence rather than whenever
              something looks interesting, because a fixed cadence is what stops
              a research schedule from becoming a reaction to the news. One name
              clears the bar each cycle and gets a full written thesis: the
              business, the case, the figures behind it, the risks, and what
              would have to be true for us to be wrong.
            </p>
            <p className="section-sub">
              Positions close when a rule says so — a guardrail is breached, or
              the case for owning the business stops holding. When that happens
              we publish an exit note covering what we owned, what changed, the
              specific rule that closed it, and what the round trip returned.
              The losing ones get the same treatment as the winners, which is
              the part of a public record that actually costs something.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-4">
              <PillButton href="/track-record" arrow>
                See the track record
              </PillButton>
              <Link
                href="/#sample-research"
                className="rounded-sm font-sans text-[12px] font-bold uppercase tracking-[0.1em] text-text-muted transition-colors hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text focus-visible:ring-offset-2"
              >
                Read a sample note →
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Where we sit. */}
      <section className="border-b border-border">
        <div className="container-op py-16 sm:py-20">
          <div className="mb-10 max-w-[560px]">
            <p className="section-label">Where we sit</p>
            <h2 className="section-title text-[28px] sm:text-[34px]">
              Between the index and the alert service.
            </h2>
          </div>
          <ComparisonTable />
        </div>
      </section>

      <section className="border-b border-border">
        <div className="container-op py-14 sm:py-16">
          <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,480px)] lg:gap-16">
            <div className="max-w-[460px]">
              <p className="section-label">Read us first</p>
              <h2 className="section-title text-[26px] sm:text-[30px]">
                Judge the thinking before you pay for it.
              </h2>
              <p className="section-sub mb-0">
                The Market Note is free and always will be. One short read a
                week on what the model is scoring and how we read the cycle.
              </p>
            </div>
            <MarketNoteSignup source="strategy" variant="panel" />
          </div>
        </div>
      </section>
    </>
  );
}
