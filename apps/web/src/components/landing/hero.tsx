import {
  SITE_SUBHEADLINE,
  SITE_TAGLINE,
} from "@/lib/constants";
import { OutpickWordmark } from "@/components/ui/outpick-logo";
import { PillButton } from "@/components/ui/pill-button";
import { LivePicksChart } from "@/components/ui/live-picks-chart";
import { PriceLine } from "./price-line";

export function Hero() {
  return (
    <section className="relative py-16 sm:py-24 overflow-hidden">
      <div className="container-op">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          <div>
            <p className="section-label mb-6 hero-reveal hero-reveal-1">
              A team of agents, researching around the clock
            </p>

            <div className="mb-8 hero-reveal hero-reveal-2">
              <OutpickWordmark size={22} />
            </div>

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
            <LivePicksChart height={240} />
          </div>
        </div>
      </div>
    </section>
  );
}
