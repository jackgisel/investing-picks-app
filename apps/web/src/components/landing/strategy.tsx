import Image from "next/image";
import { BACKTEST } from "@/lib/constants";
import { CategoryTag } from "@/components/ui/category-tag";
import { TONE_BORDER, type PastelTone } from "@/lib/tones";

const PILLARS: {
  num: string;
  title: string;
  short: string;
  description: string;
  tone: PastelTone;
}[] = [
  {
    num: "01",
    title: "Value over noise",
    short: "VALUE",
    tone: "yellow",
    description:
      "We buy businesses, not tickers. Every pick starts with durable economics — margins, cash flow, balance sheet strength, and a moat that can survive a bad year.",
  },
  {
    num: "02",
    title: "Market cycles matter",
    short: "CYCLES",
    tone: "peach",
    description:
      "The same company can be a buy or a pass depending on where we are in the cycle. Sector rotation, macro regimes, and valuation context come before position size.",
  },
  {
    num: "03",
    title: "Fundamentals first",
    short: "FUNDAMENTALS",
    tone: "lilac",
    description:
      "Revenue quality, earnings revisions, and financial health drive every decision. We look for what the market hasn't priced in yet — with evidence behind every claim.",
  },
  {
    num: "04",
    title: "Conviction with guardrails",
    short: "CONVICTION",
    tone: "mint",
    description:
      "We hold with intention, but we don't ignore risk. Sector limits, drawdown controls, and sizing keep the book disciplined — so one bad idea can't undo years of research.",
  },
];

export function Strategy() {
  return (
    <section
      id="strategy"
      className="relative border-b border-border overflow-hidden"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_55%_45%_at_100%_0%,rgba(240,168,108,0.08),transparent_55%)]"
      />

      <div className="container-op relative py-20 sm:py-24">
        <div className="grid grid-cols-1 lg:grid-cols-[1.1fr_0.9fr] gap-14 lg:gap-20 items-end mb-14 sm:mb-16">
          <div>
            <p className="section-label section-label-cyan">Our strategy</p>
            <h2 className="section-title text-[32px] sm:text-[40px] leading-tight max-w-[520px]">
              Value investing for real market cycles.
            </h2>
            <p className="section-sub mb-0 max-w-[480px]">
              Patience of long-term value. Rigor of quantitative research. One
              well-researched business at a time — not day trades, memes, or
              index tourism.
            </p>
          </div>
          <div className="relative">
            <div
              aria-hidden
              className="absolute -inset-3 rounded-soft border border-dashed border-border/70"
            />
            <div className="illustration-plate relative aspect-[5/4]">
              <Image
                src="/illustrations/strategy-value.png"
                alt=""
                fill
                className="illustration-art object-contain p-6"
                sizes="(max-width: 1024px) 100vw, 40vw"
              />
            </div>
          </div>
        </div>

        <ol className="divide-y divide-border border-y border-border mb-12 sm:mb-14">
          {PILLARS.map((pillar) => (
            <li
              key={pillar.title}
              className={`grid grid-cols-1 sm:grid-cols-[56px_minmax(0,200px)_minmax(0,1fr)] gap-4 sm:gap-8 py-7 sm:py-8 items-start border-l-2 pl-5 sm:pl-6 ${
                TONE_BORDER[pillar.tone]
              }`}
            >
              <span className="font-mono text-[12px] font-bold text-text-dim tracking-wider pt-1">
                {pillar.num}
              </span>
              <div>
                <CategoryTag tone={pillar.tone} className="mb-0">
                  {pillar.short}
                </CategoryTag>
                <h3 className="font-sans text-[17px] font-bold mt-3 tracking-tight sm:hidden">
                  {pillar.title}
                </h3>
              </div>
              <div className="sm:pt-0.5">
                <h3 className="font-sans text-[17px] font-bold mb-2 tracking-tight hidden sm:block">
                  {pillar.title}
                </h3>
                <p className="font-sans text-[15px] text-text-muted leading-relaxed">
                  {pillar.description}
                </p>
              </div>
            </li>
          ))}
        </ol>

        <blockquote className="border-l-2 border-text pl-6 sm:pl-7 max-w-[680px]">
          <h3 className="font-sans text-[16px] font-bold mb-2 tracking-tight">
            Transparent by design
          </h3>
          <p className="font-sans text-[15px] text-text-muted leading-relaxed">
            We show our live portfolio, our backtest ({BACKTEST.totalReturn}{" "}
            total · {BACKTEST.sharpe} Sharpe · {BACKTEST.maxDrawdown} max
            drawdown), and our reasoning — including the losses. Membership
            isn&apos;t black-box signals; it&apos;s joining a research team
            that publishes its work.
          </p>
        </blockquote>
      </div>
    </section>
  );
}
