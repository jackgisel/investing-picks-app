import { FOUNDERS_DEAL_ENDS_LABEL } from "@/lib/constants";

/**
 * Every question the site answers, in one place.
 *
 * Answers are plain strings rather than JSX on purpose: the same array feeds
 * the rendered accordion and the FAQPage JSON-LD, and structured data has to be
 * text. Keeping one source means the markup a crawler reads and the copy a
 * person reads cannot drift apart, which is exactly the kind of mismatch that
 * gets rich results pulled.
 */

export type FaqItem = { q: string; a: string };
export type FaqGroup = { title: string; items: FaqItem[] };

export const FAQ_GROUPS: FaqGroup[] = [
  {
    title: "What Outpick is",
    items: [
      {
        q: "Who is Outpick?",
        a: "Outpick is an independent equity research publication. We score US-listed businesses on fundamentals, write the thesis, and publish a live example portfolio with its performance in the open. It is for investors who already own index funds and want to own a few businesses on purpose.",
      },
      {
        q: "Who runs Outpick?",
        a: "Outpick is an independent equity research publication. We publish under the Outpick name rather than a founder's, because we'd rather be judged on the record than on a biography. The model, the picks, the live portfolio and every closed trade are on this site for that reason. We are not a registered adviser, broker-dealer, or bank, and membership fees are our only revenue: no advertising, no sponsored content, no affiliate links.",
      },
      {
        q: "Why should I trust research that doesn't name its analysts?",
        a: "Every two weeks we rescore roughly 3,600 US-listed stocks, write up the one name the framework agrees on, and review it before it publishes. We publish under the Outpick name instead of an analyst's because the record is checkable and a biography isn't. The methodology, the validation windows, and every live entry and exit are on this site. If the process stops working, you'll see it here before you hear it from us.",
      },
      {
        q: "Is this financial advice?",
        a: "No. Outpick is an educational publication. We share our own portfolio, research, and analysis. All investment decisions are entirely yours. We are not registered investment advisers, broker-dealers, or financial planners. Past performance does not guarantee future results.",
      },
    ],
  },
  {
    title: "How we invest",
    items: [
      {
        q: "What is your investment strategy?",
        a: "We practice value-based investing grounded in business fundamentals. We look for quality businesses trading below what the business is worth, we underwrite them over years rather than quarters, and we manage risk with clear guardrails on sizing and sector concentration.",
      },
      {
        q: "Is Outpick for investing or for trading?",
        a: "Investing, and the distinction is the whole product. We research businesses we expect to own for years. We do not publish trading strategies, entry and exit prices, chart setups, options plays, or signals you are meant to act on within the hour. If you are looking for someone to tell you what to trade this week, we are the wrong service and we would rather you found that out here than after paying.",
      },
      {
        q: "How long do you hold a position?",
        a: "Years, not quarters, and we do not publish a target holding period because that would be a promise about the future rather than a description of the process. A position is held while the reasons for owning it hold. Positions close when a guardrail is hit or the case for owning the business stops being true. When that happens we publish a note explaining it.",
      },
      {
        q: "What kind of stocks do you pick?",
        a: "Profitable businesses that are hard to compete with and still growing. Many are small-cap and mid-cap names that make up a sliver of the major indices. No meme stocks and no day trades.",
      },
      {
        q: "Do you tell members when you sell?",
        a: "Yes, and this is not optional or occasional. Every closed position gets an exit note that states what we owned, why we bought it, what changed, the rule that closed it, and what the round trip returned. The losses get the same treatment as the winners. A record that only publishes the exits that worked is a marketing asset.",
      },
    ],
  },
  {
    title: "Performance and the record",
    items: [
      {
        q: "How is performance calculated?",
        a: "The live example portfolio marks each pick at the closing price on its entry and exit dates. The positions are real and the sizing is illustrative, so the return reflects price movement rather than dollar size. Returns are always published as percentages, never as book values. Where we show results from testing the method before it went live, those are labeled as simulated and are never blended with the live numbers.",
      },
      {
        q: "Do you guarantee returns?",
        a: "No. All investing carries risk, including loss of principal. Our track record is real, but past performance is not indicative of future results.",
      },
    ],
  },
  {
    title: "Membership and billing",
    items: [
      {
        q: "What is the Market Note?",
        a: "A free email every Monday: what the model is scoring across roughly 3,600 US-listed stocks, which sectors are moving, and how we read the current cycle. It's market commentary. Our picks and the live portfolio are for members. One click unsubscribes, and we never share your address.",
      },
      {
        q: "What is the founders deal?",
        a: `Through ${FOUNDERS_DEAL_ENDS_LABEL}, eligible new members pay $250 for their first year, then $1,000 per year. The offer can be redeemed once per Outpick account. Applicable taxes are added at checkout.`,
      },
      {
        q: "Can I cancel my subscription?",
        a: "Yes. Billing is annual through Stripe. Cancel anytime from account settings; you keep access through the end of your current billing period.",
      },
    ],
  },
];

/** Flattened, for structured data and anywhere a single list is wanted. */
export const FAQ_ITEMS: FaqItem[] = FAQ_GROUPS.flatMap((g) => g.items);
