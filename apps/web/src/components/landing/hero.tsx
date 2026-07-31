import Image from "next/image";
import { SITE_SUBHEADLINE } from "@/lib/constants";
import { PillButton } from "@/components/ui/pill-button";
import { PriceLine } from "./price-line";

export function Hero() {
  return (
    <section className="heritage-hero relative">
      <div className="heritage-hero__inner">
        <div className="heritage-hero__copy text-center">
          <p className="section-label justify-center mb-8 hero-reveal hero-reveal-1">
            Independent equity research
          </p>

          <h1 className="heritage-hero__title hero-reveal hero-reveal-3">
            See beyond
            <br />
            the index.
          </h1>

          <p className="font-sans text-[16px] sm:text-[18px] text-text-muted max-w-[520px] mx-auto mt-7 mb-9 leading-relaxed hero-reveal hero-reveal-4">
            {SITE_SUBHEADLINE} Understand what you own—and why you own it.
          </p>

          <div className="hero-reveal hero-reveal-5">
            <PillButton href="/dashboard" arrow className="hero-cta">
              Explore the live portfolio
            </PillButton>
            <PriceLine className="mt-4" />
          </div>

          <div className="hero-meta justify-center mt-11 font-sans hero-reveal hero-reveal-5">
            <span>Published every two weeks</span>
            <span>Every entry and exit recorded</span>
          </div>
        </div>

        <div className="heritage-hero__art hero-reveal hero-reveal-4" aria-hidden>
          <Image
            src="/brand/heritage/classical-garden-v2.png"
            alt=""
            fill
            sizes="100vw"
            className="heritage-hero__image"
            priority
          />
        </div>
      </div>
    </section>
  );
}
