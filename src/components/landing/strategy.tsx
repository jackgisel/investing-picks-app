import { BookOpen, TrendingUp, BarChart3, Shield } from "lucide-react";

const PILLARS = [
  {
    title: "Value over noise",
    icon: BookOpen,
    description:
      "Inspired by Warren Buffett's discipline: we buy businesses, not tickers. Every pick starts with durable economics — margins, cash flow, balance sheet strength, and a moat that can survive a bad year.",
  },
  {
    title: "Market cycles matter",
    icon: TrendingUp,
    description:
      "The same company can be a buy or a pass depending on where we are in the cycle. We study sector rotation, macro regimes, and valuation context — the way top venture and quant firms size risk before they size positions.",
  },
  {
    title: "Fundamentals first",
    icon: BarChart3,
    description:
      "Revenue quality, earnings revisions, and financial health drive every decision. We read filings the way Jane Street reads data — looking for what the market hasn't priced in yet, with evidence behind every claim.",
  },
  {
    title: "Conviction with guardrails",
    icon: Shield,
    description:
      "We hold with intention, but we don't ignore risk. Sector limits, drawdown controls, and position sizing keep the portfolio disciplined — so one bad idea can't undo years of research.",
  },
] as const;

export function Strategy() {
  return (
    <section id="strategy" className="border-b border-border">
      <div className="container-op py-20">
        <p className="section-label">OUR STRATEGY</p>
        <h2 className="section-title">Value investing for real market cycles.</h2>
        <p className="section-sub">
          Outpick combines the patience of long-term value investing with the
          rigor of quantitative research. We&apos;re not day traders, meme chasers,
          or index fund tourists — we&apos;re a team building a portfolio one
          well-researched business at a time.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-0.5 bg-border mb-0.5">
          {PILLARS.map((pillar) => {
            const Icon = pillar.icon;
            return (
              <div key={pillar.title} className="bg-bg-secondary p-7">
                <div className="flex items-center gap-3 mb-3">
                  <Icon size={16} className="text-accent-green" />
                  <span className="font-sans text-[14px] font-semibold">
                    {pillar.title}
                  </span>
                </div>
                <p className="font-sans text-[13px] text-text-muted leading-relaxed">
                  {pillar.description}
                </p>
              </div>
            );
          })}
        </div>

        <div className="bg-bg-secondary border-t border-border p-7">
          <h3 className="font-sans text-[15px] font-semibold mb-1.5">
            Transparent by design
          </h3>
          <p className="font-sans text-[13px] text-text-muted leading-relaxed max-w-[720px]">
            We show our live portfolio, our backtest, and our reasoning — including
            the losses. Membership isn&apos;t about black-box signals. It&apos;s about
            joining a research team that publishes its work so you can learn,
            decide, and build financial confidence on your own terms.
          </p>
        </div>
      </div>
    </section>
  );
}
