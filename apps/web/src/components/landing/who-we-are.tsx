import { BACKTEST } from "@/lib/constants";
import { CategoryTag } from "@/components/ui/category-tag";
import { type PastelTone } from "@/lib/tones";

const PRINCIPLES: {
  label: string;
  tone: PastelTone;
  title: string;
  body: string;
}[] = [
  {
    label: "The record",
    tone: "mint",
    title: "We publish the record, not the personalities",
    body: "No founder story, no headshots, no track record you have to take on faith. The model, the picks, the live book, and every closed trade are on this site — that is the credential. Judge the work.",
  },
  {
    label: "Funding",
    tone: "yellow",
    title: "Memberships are our only revenue",
    body: "No advertising, no sponsored posts, no paid placements, no affiliate links, and nothing sold to you after you join. If a pick is here, it is because the research supported it.",
  },
  {
    label: "The losses",
    tone: "peach",
    title: "Losers stay on the page",
    body: `We publish max drawdown (${BACKTEST.maxDrawdown}), win rate (${BACKTEST.winRate}), and every position that went against us. A track record without losses in it is a marketing asset, not a track record.`,
  },
  {
    label: "The method",
    tone: "lilac",
    title: "Tested before it was sold",
    body: `The model was trained on one period and tested on data it had never seen (${BACKTEST.validationStart} – ${BACKTEST.validationEnd}) before we put a dollar behind it or charged anyone for it.`,
  },
];

const COMPARISON: {
  dimension: string;
  index: string;
  newsletter: string;
  outpick: string;
}[] = [
  {
    dimension: "What you own",
    index: "500 companies, weighted by size",
    newsletter: "A list of alerts",
    outpick: "One researched business at a time",
  },
  {
    dimension: "Why you own it",
    index: "No reason — it's in the index",
    newsletter: "Because the pick was sent",
    outpick: "A written thesis you can check",
  },
  {
    dimension: "Track record",
    index: "The market, by definition",
    newsletter: "Selected highlights",
    outpick: "Backtest, live book, every closed trade",
  },
  {
    dimension: "Risk disclosed",
    index: "Market risk",
    newsletter: "Rarely published",
    outpick: `Sharpe ${BACKTEST.sharpe} · max DD ${BACKTEST.maxDrawdown}`,
  },
  {
    dimension: "What it costs",
    index: "A fraction of a percent",
    newsletter: "Tiers, upsells, sales calls",
    outpick: "One price. No upsells, no calls.",
  },
];

export function WhoWeAre() {
  return (
    <section
      id="who-we-are"
      className="relative border-b border-border overflow-hidden"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_0%_0%,rgba(168,217,160,0.09),transparent_60%)]"
      />

      <div className="container-op relative py-20 sm:py-24">
        <div className="max-w-[640px] mb-14 sm:mb-16">
          <p className="section-label section-label-mint">Who we are</p>
          <h2 className="section-title">
            A research firm with a public track record.
          </h2>
          <p className="section-sub mb-0">
            Outpick is an independent equity research publication. We are not a
            broker, not a registered adviser, and not a personality selling
            access to themselves. We do one thing: research US-listed businesses,
            publish what we find, and keep score in the open.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-10 mb-16 sm:mb-20">
          {PRINCIPLES.map((p) => (
            <div key={p.title}>
              <CategoryTag tone={p.tone} className="mb-4">
                {p.label}
              </CategoryTag>
              <h3 className="font-sans text-[17px] sm:text-[18px] font-bold mb-2.5 tracking-tight">
                {p.title}
              </h3>
              <p className="font-sans text-[15px] text-text-muted leading-relaxed">
                {p.body}
              </p>
            </div>
          ))}
        </div>

        <div>
          <p className="font-sans text-[11px] font-bold tracking-[0.14em] uppercase text-text mb-6">
            Where we sit
          </p>

          <div className="overflow-x-auto -mx-1 px-1">
            <table className="w-full min-w-[680px] border-collapse">
              <caption className="sr-only">
                How Outpick compares to index funds and typical stock
                newsletters
              </caption>
              <thead>
                <tr className="border-b border-border-strong">
                  <th scope="col" className="w-[18%] px-4 py-4 text-left">
                    <span className="sr-only">Dimension</span>
                  </th>
                  <th
                    scope="col"
                    className="w-[26%] px-4 py-4 text-left font-sans text-[11px] font-bold tracking-[0.12em] uppercase text-text-dim"
                  >
                    Index fund
                  </th>
                  <th
                    scope="col"
                    className="w-[26%] px-4 py-4 text-left font-sans text-[11px] font-bold tracking-[0.12em] uppercase text-text-dim"
                  >
                    Typical stock newsletter
                  </th>
                  <th
                    scope="col"
                    className="w-[30%] px-4 py-4 text-left font-sans text-[11px] font-bold tracking-[0.12em] uppercase text-accent-green"
                  >
                    Outpick
                  </th>
                </tr>
              </thead>
              <tbody>
                {COMPARISON.map((row) => (
                  <tr key={row.dimension} className="border-b border-border">
                    <th
                      scope="row"
                      className="px-4 py-5 text-left align-top font-sans text-[11px] font-bold tracking-[0.1em] uppercase text-text-dim"
                    >
                      {row.dimension}
                    </th>
                    <td className="px-4 py-5 align-top font-sans text-[14px] text-text-muted">
                      {row.index}
                    </td>
                    <td className="px-4 py-5 align-top font-sans text-[14px] text-text-muted">
                      {row.newsletter}
                    </td>
                    <td className="px-4 py-5 align-top font-sans text-[14px] text-text font-medium bg-accent-green-soft/25">
                      {row.outpick}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="font-sans text-[12px] text-text-dim mt-5 leading-relaxed max-w-[70ch]">
            Index funds are a good default and we are not arguing otherwise —
            most people should own them. This is about the part of a portfolio
            where you want a reason behind every position.
          </p>
        </div>
      </div>
    </section>
  );
}
