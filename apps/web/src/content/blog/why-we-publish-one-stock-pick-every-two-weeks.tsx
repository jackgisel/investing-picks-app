import type { Article } from "@/lib/blog";
import {
  Prose,
  Lede,
  H2,
  P,
  UL,
  LI,
  Strong,
  A,
  Callout,
  KeyTakeaway,
  FAQList,
  TLDR,
  InlineCTA,
} from "@/components/blog/prose";

const article: Article = {
  meta: {
    slug: "why-we-publish-one-stock-pick-every-two-weeks",
    title: "Why we publish one stock pick every two weeks",
    description:
      "Why Outpick publishes one stock pick every two weeks: conviction over noise, a cadence you can actually follow, and how biweekly research compounds without becoming a second job.",
    keyword: "one stock pick every two weeks",
    keywords: [
      "biweekly stock picks",
      "stock picking cadence",
      "long term investing routine",
      "concentrated portfolio",
    ],
    publishedAt: "2026-07-09",
    category: "Strategy",
    tags: ["cadence", "process", "biweekly"],
    readingTime: 7,
    author: "Outpick Research",
  },
  Content: () => (
    <Prose>
      <Lede>
        Most stock-picking products fail for the same reason diets fail: they ask for more
        attention than a normal life can give. One pick every two weeks is our answer to that.
      </Lede>

      <TLDR>
        <P>
          Outpick publishes roughly one new idea every two weeks. That cadence matches how we
          actually underwrite risk in the live book, keeps research depth high, and gives
          members a followable routine instead of a firehose of tickers. More picks would feel
          busier. They would not necessarily compound better.
        </P>
      </TLDR>

      <H2>Noise is not a strategy</H2>
      <P>
        The market produces infinite novelty. Earnings every day, narratives every hour,
        screens that can spit out fifty &ldquo;interesting&rdquo; names before breakfast. If
        your research process tries to keep up with that firehose, you stop underwriting
        businesses and start collecting tickets.
      </P>
      <P>
        We are not trying to win the week. We are trying to own a small set of businesses with
        asymmetric upside and hold them long enough for the thesis to play out. That job does
        not require twenty new ideas a month. It requires a few good ones, sized and timed with
        care. For more on why a handful of winners matter more than batting average, see{" "}
        <A href="/blog/how-to-find-10x-stocks-as-a-long-term-investor">
          how to find 10x stocks
        </A>
        .
      </P>

      <H2>Why biweekly fits the live book</H2>
      <P>
        Our strategy evaluates on a biweekly rhythm. That is not marketing copy — it is how
        capital actually gets committed in the{" "}
        <A href="/dashboard">live portfolio</A>. Publishing on the same cadence keeps the
        public research surface honest: when we add a name, we explain it; when we do not add,
        we are not inventing content to fill a daily quota.
      </P>
      <P>
        Biweekly also leaves room for the unglamorous work: reading filings, checking credit
        and cycle context, updating existing positions, and saying no. A daily newsletter
        incentivizes saying yes. A fortnightly note incentivizes being right enough to publish.
      </P>

      <Callout variant="info" title="Cadence is a risk control">
        <P>
          Limiting new ideas limits how fast you can dilute a concentrated book. If every week
          brings another &ldquo;must own&rdquo; ticker, concentration becomes a slogan instead
          of a portfolio construction choice. See also{" "}
          <A href="/blog/how-many-stocks-should-you-hold-to-beat-the-market">
            how many stocks you should hold
          </A>
          .
        </P>
      </Callout>

      <H2>What members actually get</H2>
      <UL>
        <LI>
          <Strong>A research note when we buy</Strong> — the business, the thesis, the risks
          — not a ticker dump.
        </LI>
        <LI>
          <Strong>A followable routine</Strong> — check in every two weeks, not every
          notification.
        </LI>
        <LI>
          <Strong>Room to size thoughtfully</Strong> — you are never asked to chase twelve
          overlapping themes at once.
        </LI>
        <LI>
          <Strong>Honesty about inactivity</Strong> — some fortnights the best decision is
          not to add.
        </LI>
      </UL>

      <H2>What this is not</H2>
      <P>
        Biweekly does not mean slow thinking. Between publishes we still mark the book, watch
        credit and cycle signals, and update conviction. It also does not mean we will never
        write more than one note in a stretch — closed positions, quarterly reviews, and
        market essays can land outside the pick cadence. The rule is simple:{" "}
        <Strong>new capital deployment stays deliberate</Strong>.
      </P>
      <P>
        If you want the philosophical case for active selection versus index beta, we wrote
        that up in{" "}
        <A href="/blog/alpha-vs-beta-what-active-stock-picking-actually-buys-you">
          alpha vs beta
        </A>
        . The biweekly cadence is the operating system that makes that philosophy livable.
      </P>

      <InlineCTA />

      <H2>Frequently asked questions</H2>
      <FAQList
        items={[
          {
            q: "What if the market is moving fast — won't you miss things?",
            a: "Possibly. We accept that. Missing a hot ticker is cheaper than owning a poorly underwritten one. The live book is built for multi-month and multi-year holds, not for catching every gap.",
          },
          {
            q: "Do you always buy exactly one stock every two weeks?",
            a: "No. The evaluation cadence is biweekly; the maximum adds per evaluation are tightly capped. Some cycles we add, some we do not. Publishing follows the research, not a content calendar.",
          },
          {
            q: "Where do I read the notes for current holdings?",
            a: "Each live position has an Insight write-up under /insights, and the dashboard links tickers through to those notes.",
          },
        ]}
      />

      <KeyTakeaway>
        <P>
          One pick every two weeks is a feature: it protects research quality, matches how
          the live book invests, and gives you a cadence you can keep for years. Busy is easy.
          Compounding is not.
        </P>
      </KeyTakeaway>
    </Prose>
  ),
};

export default article;
