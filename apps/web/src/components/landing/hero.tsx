import { PillButton } from "@/components/ui/pill-button";
import { HeroOutperformance } from "./hero-outperformance";
import { HeroPickBubbles } from "./hero-pick-bubbles";
import { PriceLine } from "./price-line";
import { DATAFAST_CHECKOUT_GOAL } from "@/lib/datafast";

/**
 * Landing hero — full-bleed lunar art as the visual plane, copy on a left scrim.
 * The art bleeds into the WhatHow section below; no separate image there.
 *
 * The art is a native <picture>, not next/image, on purpose. The two crops are
 * art direction rather than two sizes of one asset, and rendering both as
 * <Image priority> emitted two preload links — every phone paid for the desktop
 * plate it would never show. <source media> picks exactly one. That costs us
 * the optimizer, so both plates are pre-encoded to WebP (2.0MB/2.3MB PNG ->
 * 115KB/165KB) with the PNGs kept only as the <img> fallback.
 */
export function Hero() {
  return (
    <section className="relative">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -bottom-40 sm:-bottom-48 lg:-bottom-56"
      >
        <picture>
          <source
            media="(min-width: 1024px)"
            srcSet="/hero-moon.webp"
            type="image/webp"
          />
          <source srcSet="/hero-moon-soft.webp" type="image/webp" />
          <img
            src="/hero-moon-soft.png"
            alt=""
            fetchPriority="high"
            decoding="async"
            className="absolute inset-0 h-full w-full object-cover object-[80%_38%] sm:object-[75%_34%] lg:object-[78%_32%]"
          />
        </picture>
        {/* Scrim behind the reading column. Light mode lightens, dark mode
            darkens — a single black wash put near-black h1 type on a darkened
            photo in light theme. */}
        <div className="absolute inset-0 bg-bg/70 dark:bg-black/45 lg:hidden" />
        {/* Left reading column only — leave the right/bottom of the art open. */}
        <div className="absolute inset-0 bg-gradient-to-r from-bg from-[12%] via-bg/80 via-[32%] to-transparent to-[58%] dark:from-bg dark:via-bg/75" />
        <div className="absolute inset-0 bg-gradient-to-t from-bg via-bg/20 via-[35%] to-transparent to-[70%] dark:from-bg dark:via-bg/30" />
        <div className="absolute inset-x-0 bottom-0 h-48 bg-gradient-to-t from-bg via-bg/85 to-transparent sm:h-56 lg:h-64" />
      </div>

      <div className="relative container-op py-20 pb-16 sm:py-28 sm:pb-20 lg:min-h-[min(88dvh,860px)] lg:py-36 lg:pb-24">
        <div className="relative max-w-[540px] [&_.text-text-muted]:text-text/85 [&_.text-text-dim]:text-text/75">
          <h1 className="font-sans text-[34px] sm:text-[44px] lg:text-[48px] font-extrabold leading-[1.15] mb-5 tracking-tight text-text hero-reveal hero-reveal-1">
            Intentional investing{" "}
            <span className="underline decoration-accent-mint decoration-[3px] underline-offset-[0.18em]">
              beyond the index
            </span>
            .
          </h1>

          <p className="font-sans text-[16px] sm:text-[17px] text-text/85 mb-5 leading-relaxed hero-reveal hero-reveal-2">
            Value-based stock research for investors who{" "}
            <span className="relative inline-block whitespace-nowrap px-0.5 pb-1">
              outgrew index funds
              <svg
                className="pointer-events-none absolute left-0 right-0 top-[85%] h-[0.55em] w-full text-accent-coral"
                viewBox="0 0 200 12"
                preserveAspectRatio="none"
                aria-hidden
              >
                <path
                  d="M1.5 7.2 C 28 11.5, 52 2.8, 78 6.4 C 104 10.1, 128 3.2, 152 7.8 C 170 10.6, 186 5.4, 198.5 8.1"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
            .
          </p>

          <HeroOutperformance className="mb-8 hero-reveal hero-reveal-2" />

          <div className="hero-reveal hero-reveal-3">
            <PillButton href="/subscribe" arrow data-fast-goal={DATAFAST_CHECKOUT_GOAL}>
              Start your membership
            </PillButton>
            <PriceLine className="mt-4" />
          </div>
        </div>

        <HeroPickBubbles />
      </div>
    </section>
  );
}
