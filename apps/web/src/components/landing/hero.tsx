import Image from "next/image";
import { PRICING, BACKTEST } from "@/lib/constants";
import { CategoryTag, type PastelTone } from "@/components/ui/category-tag";
import { PillButton } from "@/components/ui/pill-button";
import { MarketNoteSignup } from "@/components/marketing/market-note-signup";

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
            <p className="section-label mb-5">Independent equity research</p>
            <h1 className="font-sans text-4xl sm:text-[48px] font-extrabold leading-[1.1] mb-6 tracking-tight uppercase">
              Own businesses.
              <br />
              Not the whole market.
            </h1>
            <p className="font-sans text-[16px] sm:text-[17px] text-text-muted max-w-[520px] mb-6 leading-relaxed">
              An index fund buys you 500 companies and no opinion about any of
              them. We&apos;re a research firm: every two weeks we publish{" "}
              <strong className="text-text">one</strong> US stock with the full
              thesis, then track it in public until we sell it.
            </p>

            {/* The legible version of the proof. The rigorous version — Sharpe,
                drawdown, walk-forward windows — lives in the track record
                section for people who want it. */}
            <dl className="flex flex-wrap items-baseline gap-x-7 gap-y-3 mb-8 pb-8 border-b border-border max-w-[520px]">
              <div>
                <dt className="font-sans text-[10px] font-bold tracking-[0.14em] uppercase text-text-dim mb-1">
                  Our model, 5 years
                </dt>
                <dd className="font-mono text-[26px] font-bold text-accent-green leading-none">
                  {BACKTEST.totalReturn}
                </dd>
              </div>
              <div>
                <dt className="font-sans text-[10px] font-bold tracking-[0.14em] uppercase text-text-dim mb-1">
                  S&amp;P 500, same window
                </dt>
                <dd className="font-mono text-[26px] font-bold text-text leading-none">
                  {BACKTEST.spyReturn}
                </dd>
              </div>
              <div>
                <dt className="font-sans text-[10px] font-bold tracking-[0.14em] uppercase text-text-dim mb-1">
                  Picks that doubled
                </dt>
                <dd className="font-mono text-[26px] font-bold text-accent-green leading-none">
                  {BACKTEST.winnersCircle}
                </dd>
              </div>
            </dl>

            <div className="flex flex-wrap gap-2 mb-8">
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

            <div className="mt-8 pt-7 border-t border-border max-w-[480px]">
              <p className="font-sans text-[13px] text-text-muted mb-3">
                Not ready to join?{" "}
                <strong className="text-text">
                  Get the weekly Market Note
                </strong>{" "}
                — free, one short read, no picks.
              </p>
              <MarketNoteSignup source="hero" />
            </div>
          </div>

          <div className="relative">
            <div className="illustration-plate aspect-square flex items-center justify-center p-6 sm:p-8">
              <Image
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
