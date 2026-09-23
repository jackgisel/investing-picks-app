import { BACKTEST, FOUNDERS_DEAL_ENDS_LABEL, PRICING } from "@/lib/constants";

/**
 * Membership offer copy for /pricing.
 *
 * Answers are plain strings so the same source can feed the page and FAQPage
 * JSON-LD. Keep this file the place a crawler and a person read the same
 * decision: what $250 / year includes, who it is for, and what it is not.
 */

export type PricingFaqItem = { q: string; a: string };

/** Four deliverables — expand in place; do not replace with a shorter list. */
export const PRICING_DELIVERABLES = [
  {
    n: "01",
    title: "A researched pick every two weeks",
    body: "One high-conviction name with the full thesis: evidence, risks, and the rules that close it. We rescore roughly 3,600 US-listed stocks on a published cadence — the 1st and 3rd Friday of each month — then write the case and review it before it publishes. Universe scan, fundamentals, estimate revisions, sector context. Not a firehose of alerts.",
  },
  {
    n: "02",
    title: "The live example portfolio",
    body: "Every open and closed position, updated as the book moves. Members see the full book: entries, exits, and the note attached to each. No cherry-picked highlights, and losers stay on the page.",
  },
  {
    n: "03",
    title: "The scoreboard vs the S&P 500",
    body: `Wins and losses both shown against the index. The live book is the going-forward record. The ${BACKTEST.yearsCovered}-year walk-forward model behind the process is published separately and labeled as simulated — it is not blended with live results.`,
  },
  {
    n: "04",
    title: "Email when a new pick lands",
    body: "Optional. You choose what reaches your inbox. No day-trade alerts, no price targets, nothing you are meant to act on within the hour.",
  },
] as const;

export const PRICING_FOR = [
  "Investors who already own index funds and want a researched sleeve with a written reason behind each name.",
  "People who will read a thesis, sit with a position for years, and can live with a public record that includes losses.",
  "Anyone who wants the method, the live book, and the scoreboard in one place — not another screener, and not a stream of tips.",
] as const;

export const PRICING_NOT_FOR = [
  "Day traders, options traders, or anyone looking for entry and exit prices, chart setups, or same-day alerts.",
  "Anyone who wants a broker, a registered adviser, or someone to execute on their behalf. We publish research; the decision is yours.",
  "Accounts where a few hundred dollars a year is a large share of capital. If the fee is material to the portfolio, a low-cost index is the better default.",
] as const;

/**
 * Buyer-objection FAQ for /pricing only. Distinct from the site-wide /faq
 * so this page can answer “what do I get, and is it for me?” without a hop.
 */
export const PRICING_FAQ: PricingFaqItem[] = [
  {
    q: "Is Outpick worth it versus free tools or a Seeking Alpha-class subscription?",
    a: `Free screeners and $300-class research platforms are good at coverage: many tickers, many notes, more data than most people will read. Outpick is the opposite shape. You get one researched name every two weeks, a live example portfolio you can audit, and a written exit when a thesis breaks. The fee is a flat ${PRICING.foundersLabel} for the first year through ${FOUNDERS_DEAL_ENDS_LABEL}, then ${PRICING.label} — not a percent of assets, and not a cheaper tier with the real product gated. Whether that is worth it depends on the size of the portfolio and whether you want a process you can check. Coverage is not the product.`,
  },
  {
    q: "Is this a signal service?",
    a: "No. Nothing here is designed to be traded the minute it appears. We do not send buy-under-$40 alerts, price targets, or chart setups. The book is re-evaluated on a fixed, published cadence. If you want someone to tell you what to trade this morning, we are the wrong publication.",
  },
  {
    q: "What is included in membership?",
    a: "One plan, full access: a researched pick every two weeks with the complete thesis; the live example portfolio; the scoreboard versus the S&P 500; and optional email when a new pick lands. There is no higher tier. Research, the live book, and the scoreboard are not split across plans.",
  },
  {
    q: "Can I cancel, and what happens to access?",
    a: "Yes. Billing is annual through Stripe, plus applicable tax. Cancel anytime from account settings; you keep access through the end of your current billing period. There is no long-term lock-in beyond the year you already paid.",
  },
  {
    q: "Do you guarantee returns? How should I read the track record?",
    a: "No. All investing carries risk, including loss of principal. Past performance does not indicate future results. We publish the live example portfolio in full — winners and losers — and we publish the walk-forward model behind the process, labeled as simulated and never blended with live numbers. Judge the record on the track record page rather than a figure on a sales page.",
  },
  {
    q: "Who should not subscribe?",
    a: "Skip this if you need the money inside a couple of years, if you want personal advice tailored to your circumstances, or if you will not actually read the research. Also skip it if the annual fee is a large share of the capital you would put to work. Outpick is for serious individual investors who outgrew plain index funds and want theses, exit rules, and an honest book.",
  },
];

export function pricingFaqJsonLd() {
  return {
    "@type": "FAQPage",
    mainEntity: PRICING_FAQ.map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: { "@type": "Answer", text: item.a },
    })),
  };
}
