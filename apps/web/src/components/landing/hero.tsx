import {
  SITE_NAME,
  SITE_SUBHEADLINE,
  SITE_TAGLINE,
} from "@/lib/constants";
import { OutpickLogo } from "@/components/ui/outpick-logo";
import { PillButton } from "@/components/ui/pill-button";
import { ThemeIllustration } from "@/components/ui/theme-illustration";
import { PriceLine } from "./price-line";

export function Hero() {
  return (
    <section className="relative py-16 sm:py-24 overflow-hidden">
      <div className="container-op">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          <div>
            <p className="section-label section-label-mint mb-6 hero-reveal hero-reveal-1">
              A stock research team
            </p>

            <div className="flex items-center gap-3.5 mb-8 hero-reveal hero-reveal-2">
              <OutpickLogo size={40} />
              <span className="font-sans text-[32px] sm:text-[40px] font-extrabold tracking-[0.1em] text-text uppercase leading-none">
                {SITE_NAME}
              </span>
            </div>

            <div
              aria-hidden
              className="h-0.5 w-12 rounded-full bg-accent-mint mb-7 hero-reveal hero-reveal-3"
            />

            <h1 className="font-sans text-[34px] sm:text-[44px] font-extrabold leading-[1.15] mb-5 tracking-tight max-w-[540px] hero-reveal hero-reveal-3">
              {SITE_TAGLINE}
            </h1>

            <p className="font-sans text-[16px] sm:text-[17px] text-text-muted max-w-[460px] mb-10 leading-relaxed hero-reveal hero-reveal-4">
              {SITE_SUBHEADLINE}
            </p>

            <div className="hero-reveal hero-reveal-5">
              <PillButton href="/subscribe" arrow>
                Start your membership
              </PillButton>
              <PriceLine className="mt-4" />
            </div>
          </div>

          <div className="relative hero-reveal hero-reveal-4">
            <div className="illustration-plate aspect-square flex items-center justify-center p-6 sm:p-8">
              <ThemeIllustration
                src="/illustrations/research.png"
                alt="Research illustration"
                width={560}
                height={560}
                className="illustration-art w-full h-full object-contain p-4"
                priority
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
