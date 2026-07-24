import Image from "next/image";
import { PRICING, BACKTEST } from "@/lib/constants";
import { CategoryTag, type PastelTone } from "@/components/ui/category-tag";
import { PillButton } from "@/components/ui/pill-button";

const PILLARS: { label: string; tone: PastelTone }[] = [
  { label: "VALUE", tone: "yellow" },
  { label: "CYCLES", tone: "peach" },
  { label: "FUNDAMENTALS", tone: "lilac" },
  { label: "CONVICTION", tone: "mint" },
];

export function Hero() {
  return (
    <section className="relative py-16 sm:py-24 overflow-hidden">
      <div className="container-op">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          <div>
            <p className="section-label mb-5">A stock research team</p>
            <h1 className="font-sans text-4xl sm:text-[48px] font-extrabold leading-[1.1] mb-6 tracking-tight uppercase">
              Beyond index funds.
              <br />
              Invest with intention.
            </h1>
            <p className="font-sans text-[16px] sm:text-[17px] text-text-muted max-w-[520px] mb-8 leading-relaxed">
              We built our model on {BACKTEST.yearsCovered} years of trailing
              market data. In walk-forward testing, {BACKTEST.winnersCircle} picks
              more than doubled while the portfolio compounded at{" "}
              <strong className="text-text">{BACKTEST.cagr} CAGR</strong> — vs{" "}
              <strong className="text-text">{BACKTEST.spyReturn}</strong> for the
              S&amp;P 500. We now trade that research in a live example portfolio.
              You build your own.
            </p>
            <div className="flex flex-wrap gap-2 mb-10">
              {PILLARS.map((pillar) => (
                <CategoryTag key={pillar.label} tone={pillar.tone}>
                  {pillar.label}
                </CategoryTag>
              ))}
            </div>
            <PillButton href="/dashboard" arrow>
              Start your membership
            </PillButton>
            <p className="mt-4 font-sans text-[13px] text-text-dim">
              Founders: {PRICING.foundersLabel} · then {PRICING.label}
            </p>
          </div>

          <div className="relative">
            <div className="soft-card aspect-square flex items-center justify-center overflow-hidden">
              <Image
                src="/illustrations/research.png"
                alt="Research illustration"
                width={560}
                height={560}
                className="w-full h-full object-contain p-4"
                priority
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
