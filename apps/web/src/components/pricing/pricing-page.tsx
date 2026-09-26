"use client";

import Image from "next/image";
import Link from "next/link";
import { PRICING } from "@/lib/constants";
import {
  PRICING_DELIVERABLES,
  PRICING_FAQ,
  PRICING_FOR,
  PRICING_NOT_FOR,
} from "@/content/pricing";
import { isFoundersDealActive } from "@/lib/portfolio";
import { PillButton } from "@/components/ui/pill-button";
import { LOGIN_ART } from "@/lib/art";
import { DATAFAST_CHECKOUT_GOAL } from "@/lib/datafast";

function SubscribeCta({
  founders,
  className,
}: {
  founders: boolean;
  className?: string;
}) {
  const price = founders ? PRICING.foundersAnnual : PRICING.annual;
  return (
    <PillButton
      href="/subscribe"
      arrow
      className={className}
      data-fast-goal={DATAFAST_CHECKOUT_GOAL}
    >
      Subscribe · ${price} / year
    </PillButton>
  );
}

function OfferCard({ founders }: { founders: boolean }) {
  const price = founders ? PRICING.foundersAnnual : PRICING.annual;

  return (
    <div className="border-t-2 border-border-strong pt-6 sm:pt-7">
      <p className="font-sans text-[11px] font-bold tracking-[0.16em] uppercase text-text-dim">
        {founders ? "Founding member · year one" : "Annual membership"}
      </p>
      <p className="mt-3 font-mono text-[52px] font-bold leading-none tracking-tight text-text sm:text-[56px]">
        ${price}
        <span className="ml-1 font-sans text-[15px] font-medium tracking-normal text-text-muted">
          / year
        </span>
      </p>
      {founders ? (
        <p className="mt-3 font-sans text-[13px] text-text-muted">
          Then {PRICING.label} from year two. Same access either way.
        </p>
      ) : (
        <p className="mt-3 font-sans text-[13px] text-text-muted">
          Flat fee. No percent of assets.
        </p>
      )}

      <div className="mt-7">
        <SubscribeCta founders={founders} className="w-full" />
      </div>

      <p className="mt-4 font-sans text-[12px] leading-relaxed text-text-dim">
        Billed annually via Stripe, plus tax. Cancel anytime from settings;
        access continues through the paid year.
      </p>
    </div>
  );
}

/**
 * Membership decision page: price and CTA above the fold, then who it is for,
 * the public record, and buyer-objection FAQ. Type does the selling.
 */
export function PricingPageView() {
  const founders = isFoundersDealActive();
  const price = founders ? PRICING.foundersAnnual : PRICING.annual;

  return (
    <div>
      <div className="relative min-h-[calc(100dvh-var(--nav-h))] overflow-hidden">
        <div aria-hidden className="pointer-events-none absolute inset-0">
          <Image
            src={LOGIN_ART.src}
            alt=""
            fill
            priority
            sizes="100vw"
            className="object-cover object-[70%_35%] opacity-[0.35] dark:opacity-[0.25]"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-bg via-bg/92 to-bg/70 dark:from-bg dark:via-bg/90 dark:to-bg/75" />
          <div className="absolute inset-0 bg-gradient-to-t from-bg via-transparent to-bg/50" />
        </div>

        <div className="relative container-op flex min-h-[calc(100dvh-var(--nav-h))] flex-col justify-center py-10 sm:py-12 lg:py-14">
          <div className="grid grid-cols-1 items-start gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(280px,340px)] lg:gap-16 xl:gap-20">
            <div>
              <p className="section-label mb-3">Membership</p>
              <h1 className="font-sans text-[32px] font-extrabold leading-[1.12] tracking-tight text-text sm:text-[40px] lg:text-[44px]">
                What you get for{" "}
                <span className="font-mono tracking-tight">${price}</span>
                <span className="text-text-muted"> / year</span>
              </h1>
              <p className="mt-4 max-w-[46ch] font-sans text-[15px] leading-relaxed text-text-muted sm:text-[16px]">
                Outpick publishes value-based stock research, not trading signals.
                One plan, billed once a year: a researched pick every two weeks,
                the live example portfolio, and the scoreboard vs the S&amp;P 500.
                This page is the whole offer: what it costs, who it is for, and
                what to check before you pay.
              </p>
              <p className="mt-3 max-w-[46ch] font-sans text-[15px] leading-relaxed text-text-muted sm:text-[16px]">
                Full access. Nothing gated behind a higher tier. Flat fee, no
                percent of assets.
              </p>

              <div className="mt-6 lg:hidden">
                <SubscribeCta founders={founders} />
              </div>

              <ol className="mt-8 space-y-0 sm:mt-10">
                {PRICING_DELIVERABLES.map((item, i) => (
                  <li
                    key={item.n}
                    className={`grid grid-cols-[2.5rem_1fr] gap-3 border-t border-border py-4 sm:gap-4 sm:py-5 ${
                      i === PRICING_DELIVERABLES.length - 1 ? "border-b" : ""
                    }`}
                  >
                    <span className="font-mono text-[12px] font-bold tracking-[0.08em] text-text-dim">
                      {item.n}
                    </span>
                    <div>
                      <h2 className="font-sans text-[15px] font-bold tracking-tight text-text sm:text-[16px]">
                        {item.title}
                      </h2>
                      <p className="mt-1 font-sans text-[13px] leading-relaxed text-text-muted sm:text-[14px]">
                        {item.body}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>

            <aside className="lg:sticky lg:top-[calc(var(--nav-h)+1.5rem)]">
              <OfferCard founders={founders} />
            </aside>
          </div>
        </div>
      </div>

      <section className="border-t border-border">
        <div className="container-op py-16 sm:py-20">
          <div className="grid grid-cols-1 gap-10 lg:grid-cols-2 lg:gap-16">
            <div>
              <p className="section-label section-label-mint">Who this is for</p>
              <h2 className="section-title text-[26px] sm:text-[30px]">
                A research membership, not a trading desk.
              </h2>
              <p className="section-sub">
                The useful test is not “do I like stocks.” It is whether you
                want a written case for a business, rules that close it, and a
                book you can audit, and whether you will actually use them.
              </p>
              <ul className="space-y-3.5">
                {PRICING_FOR.map((item) => (
                  <li
                    key={item}
                    className="flex items-start gap-3 font-sans text-[15px] leading-relaxed text-text-muted"
                  >
                    <span
                      aria-hidden
                      className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-accent-mint"
                    />
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <p className="section-label">Who this is not for</p>
              <h2 className="section-title text-[26px] sm:text-[30px]">
                Skip it if you want alerts or advice.
              </h2>
              <p className="section-sub">
                Most of what people expect from a stock site, we do not do. We
                would rather you found that out here than after paying.
              </p>
              <ul className="space-y-3.5">
                {PRICING_NOT_FOR.map((item) => (
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
                className="mt-7 inline-flex rounded-sm font-sans text-[14px] font-semibold text-text underline decoration-border-strong underline-offset-4 transition-opacity hover:decoration-text hover:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
              >
                What we are not →
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="border-t border-border bg-bg-secondary/30">
        <div className="container-op py-16 sm:py-20">
          <div className="max-w-[680px]">
            <p className="section-label section-label-yellow">The record</p>
            <h2 className="section-title text-[26px] sm:text-[30px]">
              Judge the book, including the losses.
            </h2>
            <p className="section-sub">
              We do not put a return figure on this page as a reason to
              subscribe. The live example portfolio and the walk-forward model
              behind it are published in full. That means every open position
              and every closed one, winners and losers. Simulated results are
              labeled as such and are never blended with the live numbers.
            </p>
            <p className="section-sub mb-0">
              If the process stops working, it will show up there before it
              shows up in a sales sentence. Past performance does not indicate
              future results.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-3">
              <PillButton href="/track-record" arrow>
                See the track record
              </PillButton>
              <Link
                href="/#live-picks"
                className="rounded-sm font-sans text-[12px] font-bold uppercase tracking-[0.1em] text-text-muted transition-colors hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
              >
                Live book →
              </Link>
              <Link
                href="/track-record"
                className="rounded-sm font-sans text-[12px] font-bold uppercase tracking-[0.1em] text-text-muted transition-colors hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
              >
                Scoreboard vs S&amp;P →
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="border-t border-border">
        <div className="container-op py-16 sm:py-20">
          <div className="max-w-[680px]">
            <p className="section-label">Questions</p>
            <h2 className="section-title text-[26px] sm:text-[30px]">
              What people ask before they pay.
            </h2>
            <p className="section-sub">
              Straight answers on cost, what is included, cancelation, and the
              record. If something here is missing, the full{" "}
              <Link
                href="/faq"
                className="font-semibold text-text underline decoration-border-strong underline-offset-4 hover:decoration-text"
              >
                FAQ
              </Link>{" "}
              covers how we invest.
            </p>

            <div className="border-t border-border">
              {PRICING_FAQ.map((item) => (
                <details
                  key={item.q}
                  className="group border-b border-border py-5"
                >
                  <summary className="flex cursor-pointer list-none items-start justify-between gap-4 font-sans text-[15px] font-semibold text-text transition-opacity group-hover:opacity-70">
                    <span>{item.q}</span>
                    <span className="mt-0.5 shrink-0 font-mono text-[18px] leading-none text-accent-green transition-transform group-open:rotate-45">
                      +
                    </span>
                  </summary>
                  <p className="mt-3 pr-8 font-sans text-[14px] leading-[1.7] text-text-muted">
                    {item.a}
                  </p>
                </details>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="border-t border-border">
        <div className="container-op py-14 sm:py-16">
          <div className="flex max-w-[640px] flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
            <div className="max-w-[420px]">
              <p className="section-label">Subscribe</p>
              <h2 className="section-title text-[26px] sm:text-[30px]">
                ${price}
                <span className="font-sans text-[18px] font-medium text-text-muted">
                  {" "}
                  / year
                </span>
              </h2>
              <p className="section-sub mb-0">
                Research every two weeks, the live book, and the scoreboard.
                Cancel from settings whenever you want.
              </p>
            </div>
            <div className="flex flex-col items-start gap-3 sm:items-end">
              <SubscribeCta founders={founders} />
              <p className="font-sans text-[12px] text-text-dim">
                {founders
                  ? `Then ${PRICING.label} from year two.`
                  : "Flat fee. No percent of assets."}
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
