"use client";

import Image from "next/image";
import Link from "next/link";
import { PRICING, BACKTEST } from "@/lib/constants";
import { isFoundersDealActive } from "@/lib/portfolio";
import { PillButton } from "@/components/ui/pill-button";
import { LOGIN_ART } from "@/lib/art";
import { DATAFAST_CHECKOUT_GOAL } from "@/lib/datafast";

const YOU_GET = [
  {
    n: "01",
    title: "A researched pick every two weeks",
    body: "One high-conviction name with the full thesis: evidence, risks, and the rules that close it. Universe scan, fundamentals, estimate revisions, sector context, a written thesis, then human review before it publishes.",
  },
  {
    n: "02",
    title: "The live example portfolio",
    body: "Every open and closed position, updated as the book moves. No cherry-picked highlights.",
  },
  {
    n: "03",
    title: "The scoreboard vs the S&P 500",
    body: `Wins and losses both shown. Plus the ${BACKTEST.yearsCovered}-year walk-forward model behind the process.`,
  },
  {
    n: "04",
    title: "Email when a new pick lands",
    body: "Optional. You choose what reaches your inbox. No day-trade alerts, no price targets.",
  },
] as const;

/**
 * Single-viewport membership page: price, what you get, one CTA.
 * Atmosphere from the dithered pool; type does the selling.
 */
export function PricingPageView() {
  const founders = isFoundersDealActive();
  const price = founders ? PRICING.foundersAnnual : PRICING.annual;

  return (
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
            <p className="mt-4 max-w-[42ch] font-sans text-[15px] leading-relaxed text-text-muted sm:text-[16px]">
              One plan. Full access. Research, the live book, and the scoreboard
              — nothing gated behind a higher tier.
            </p>

            <ol className="mt-8 space-y-0 sm:mt-10">
              {YOU_GET.map((item, i) => (
                <li
                  key={item.n}
                  className={`grid grid-cols-[2.5rem_1fr] gap-3 border-t border-border py-4 sm:gap-4 sm:py-5 ${
                    i === YOU_GET.length - 1 ? "border-b" : ""
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

            <p className="mt-6 max-w-[48ch] font-sans text-[12px] leading-relaxed text-text-dim sm:mt-8">
              Not a broker, not personal advice, not a signal service.{" "}
              <Link
                href="/what-we-are-not"
                className="font-semibold text-text underline decoration-border-strong underline-offset-4 hover:decoration-text"
              >
                What we are not
              </Link>
              {" · "}
              <Link
                href="/track-record"
                className="font-semibold text-text underline decoration-border-strong underline-offset-4 hover:decoration-text"
              >
                Track record
              </Link>
            </p>
          </div>

          <aside className="lg:sticky lg:top-[calc(var(--nav-h)+1.5rem)]">
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
                <PillButton
                  href="/subscribe"
                  arrow
                  className="w-full"
                  data-fast-goal={DATAFAST_CHECKOUT_GOAL}
                >
                  {founders ? "Start at founders rate" : "Start membership"}
                </PillButton>
              </div>

              <p className="mt-4 font-sans text-[12px] leading-relaxed text-text-dim">
                Billed annually via Stripe, plus tax. Cancel anytime from
                settings.
              </p>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
