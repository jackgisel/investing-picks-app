import { BACKTEST } from "@/lib/constants";
import { CategoryTag } from "@/components/ui/category-tag";
import { TONE_BORDER, type PastelTone } from "@/lib/tones";

const personas: {
  title: string;
  description: string;
  tone: PastelTone;
  label: string;
}[] = [
  {
    title: "Ready for better returns",
    label: "Upside",
    tone: "yellow",
    description:
      "You've done well in index funds, but you know there's upside in owning great businesses directly — if someone else does the research.",
  },
  {
    title: "Investing with intention",
    label: "Thesis",
    tone: "peach",
    description:
      "You want every position to have a thesis, not just a ticker weight in VOO. You care about why you own what you own.",
  },
  {
    title: "Building real confidence",
    label: "Process",
    tone: "mint",
    description:
      "You want a research team that shows its work — wins, losses, and reasoning included — so you can learn while you invest.",
  },
];

export function Audience() {
  return (
    <section className="relative border-b border-border overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-gradient-to-b from-bg-secondary/50 via-transparent to-transparent"
      />

      <div className="container-op relative py-20 sm:py-24">
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,380px)] gap-10 lg:gap-16 items-start mb-14">
          <div>
            <p className="section-label section-label-peach">Why we exist</p>
            <h2 className="section-title max-w-[520px]">
              We outgrew passive. You probably have too.
            </h2>
            <p className="section-sub mb-0 max-w-[480px]">
              Index funds are a strong starting point — but they cap upside and
              leave you passive in your own portfolio. Outpick is the research
              team we wished we had when we made that leap.
            </p>
          </div>

          <blockquote className="border-l-2 border-accent-yellow pl-6 sm:pl-7 py-1 lg:mt-6">
            <p className="font-sans text-[10px] font-bold tracking-[0.14em] uppercase text-text-dim mb-2">
              Walk-forward backtest
            </p>
            <p className="font-sans text-[16px] sm:text-[17px] text-text leading-snug">
              <span className="font-mono font-bold text-accent-green">
                {BACKTEST.winnersCircle}
              </span>{" "}
              picks doubled ·{" "}
              <span className="font-mono font-bold text-accent-green">
                {BACKTEST.cagr}
              </span>{" "}
              CAGR ·{" "}
              <span className="font-mono font-bold">{BACKTEST.spyReturn}</span>{" "}
              S&amp;P 500
            </p>
          </blockquote>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 border-t border-border">
          {personas.map((p, i) => (
            <div
              key={p.title}
              className={`op-animate-rise py-10 lg:py-12 border-t-2 -mt-px ${
                TONE_BORDER[p.tone]
              } ${i === 1 ? "op-animate-rise-delay-1" : ""} ${
                i < personas.length - 1
                  ? "border-b lg:border-b-0 lg:border-r border-b-border lg:border-r-border lg:pr-10 lg:mr-10"
                  : ""
              }`}
            >
              <CategoryTag tone={p.tone} className="mb-5">
                {p.label}
              </CategoryTag>
              <h3 className="font-sans text-[18px] sm:text-[19px] font-bold mb-3 tracking-tight">
                {p.title}
              </h3>
              <p className="font-sans text-[15px] text-text-muted leading-relaxed">
                {p.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
