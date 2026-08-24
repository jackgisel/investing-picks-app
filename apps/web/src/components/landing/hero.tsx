import Image from "next/image";
import { BACKTEST } from "@/lib/constants";
import { PillButton } from "@/components/ui/pill-button";
import { HeroOutperformance } from "./hero-outperformance";
import { HeroPickBubbles } from "./hero-pick-bubbles";
import { PriceLine } from "./price-line";

/**
 * Landing hero — full-bleed lunar art as the visual plane, copy on a left scrim.
 * The art bleeds into the WhatHow section below; no separate image there.
 */
export function Hero() {
  return (
    <section className="relative">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -bottom-40 sm:-bottom-48 lg:-bottom-56"
      >
        <Image
          src="/hero-moon-soft.png"
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover object-[80%_38%] sm:object-[75%_34%] lg:hidden"
        />
        <Image
          src="/hero-moon.png"
          alt=""
          fill
          priority
          sizes="100vw"
          className="hidden object-cover object-[78%_32%] lg:block"
        />
        {/* Mobile — darken art so overlaid copy stays readable. */}
        <div className="absolute inset-0 bg-black/45 lg:hidden" />
        {/* Left reading column only — leave the right/bottom of the art open. */}
        <div className="absolute inset-0 bg-gradient-to-r from-bg from-[12%] via-bg/80 via-[32%] to-transparent to-[58%] dark:from-bg dark:via-bg/75" />
        <div className="absolute inset-0 bg-gradient-to-t from-bg via-bg/20 via-[35%] to-transparent to-[70%] dark:from-bg dark:via-bg/30" />
        <div className="absolute inset-x-0 bottom-0 h-48 bg-gradient-to-t from-bg via-bg/85 to-transparent sm:h-56 lg:h-64" />
      </div>

      <div className="relative container-op py-20 pb-16 sm:py-28 sm:pb-20 lg:min-h-[min(88vh,860px)] lg:py-36 lg:pb-24">
        <div className="relative max-w-[540px] [&_.text-text-muted]:text-text/85 [&_.text-text-dim]:text-text/75">
          <h1 className="font-sans text-[34px] sm:text-[44px] font-extrabold leading-[1.15] mb-5 tracking-tight text-text hero-reveal hero-reveal-1">
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

          <p className="mb-8 font-sans text-[13px] text-text/75 hero-reveal hero-reveal-2 lg:hidden">
            {BACKTEST.winnersCircle} closed picks doubled or better on the model
          </p>

          <div className="hero-reveal hero-reveal-3">
            <PillButton href="/subscribe" arrow>
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
