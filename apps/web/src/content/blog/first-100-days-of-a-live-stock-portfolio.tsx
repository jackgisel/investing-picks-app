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
    slug: "first-100-days-of-a-live-stock-portfolio",
    title: "What the first 100 days of a live portfolio actually feel like",
    description:
      "Lessons from the first ~100 days of Outpick's live portfolio: early dispersion, why paper returns lie, and how to judge a young book without rewriting the strategy every week.",
    keyword: "first 100 days live stock portfolio",
    keywords: [
      "live portfolio vs backtest",
      "early portfolio performance",
      "stock picking track record",
      "starting a concentrated portfolio",
    ],
    publishedAt: "2026-07-21",
    category: "Performance",
    tags: ["live portfolio", "track record", "process"],
    readingTime: 8,
    author: "Outpick Research",
  },
  Content: () => (
    <Prose>
      <Lede>
        A backtest is a closed book. A live portfolio is an open one — with marks that move
        while you are still building the cast of characters. The first hundred days teach
        different lessons than year five.
      </Lede>

      <TLDR>
        <P>
          Outpick&apos;s live book started in April 2026. The early months are about seeding
          positions on a biweekly cadence, surviving noisy P&amp;L, and resisting the urge to
          rewrite rules after every green or red week. Judge a young portfolio on process
          adherence and thesis quality first — headline return second.
        </P>
      </TLDR>

      <H2>Live is not a replay of the backtest</H2>
      <P>
        Our walk-forward work (see{" "}
        <A href="/blog/walk-forward-backtesting-explained">
          walk-forward backtesting explained
        </A>
        ) answered a specific question: did the rules work on data the fitting process never
        saw? That is necessary. It is not the same as sitting with real marks, real
        liquidity, and a book that is still incomplete.
      </P>
      <P>
        In the first hundred days you do not yet have a full roster. Returns are path-dependent
        on which names cleared the bar first. One early winner can dominate the percentage
        tape; one early laggard can make the whole experiment feel broken. Neither outcome
        proves or kills a multi-year strategy by itself.
      </P>

      <H2>Dispersion shows up immediately</H2>
      <P>
        Concentrated books are honest. When you own a handful of positions, day-to-day P&amp;L
        is not a smooth index line — it is a handful of businesses arguing with the market.
        That is uncomfortable if you grew up on VOO charts. It is also the point. Alpha, if
        it exists, comes from{" "}
        <A href="/blog/alpha-vs-beta-what-active-stock-picking-actually-buys-you">
          intentional difference
        </A>
        , not from matching the crowd&apos;s calendar.
      </P>
      <P>
        Early on we have already seen the usual shape: a few names working hard, a few flat,
        and at least one that makes you re-read the thesis with a colder eye. The discipline
        is not pretending every position is &ldquo;fine.&rdquo; The discipline is separating{" "}
        <Strong>thesis broken</Strong> from <Strong>price noisy</Strong>.
      </P>

      <Callout variant="info" title="What we check when a name goes red">
        <UL>
          <LI>Did the business thesis change, or only the quote?</LI>
          <LI>Is credit, regulation, or competition worse than we underwrote?</LI>
          <LI>Would we still initiate today at this price?</LI>
          <LI>Is the position sized so a full loss cannot force bad decisions elsewhere?</LI>
        </UL>
      </Callout>

      <H2>Process beats narrative in year zero</H2>
      <P>
        The temptation in month three is to declare victory or declare failure. Both are
        usually premature. What you can evaluate early:
      </P>
      <UL>
        <LI>
          <Strong>Cadence</Strong> — are we still adding on the biweekly rhythm we promised,
          not impulsively?
        </LI>
        <LI>
          <Strong>Documentation</Strong> — does every live name have a clear Insight note
          with risks, not just a bull case?
        </LI>
        <LI>
          <Strong>Rule fidelity</Strong> — are we respecting max adds, sizing, and exit logic
          instead of improvising?
        </LI>
        <LI>
          <Strong>Honesty</Strong> — are percentage returns shown without hiding the ugly
          rows?
        </LI>
      </UL>
      <P>
        Those are leading indicators. Trailing return becomes more informative as the book
        seasons and as more evaluation cycles complete. Until then, process is the scoreboard
        that does not lie as easily as a short sample of marks.
      </P>

      <H2>How we want you to read the dashboard</H2>
      <P>
        Use the <A href="/dashboard">dashboard</A> as a living lab notebook, not a mutual-fund
        fact sheet. Members can open{" "}
        <A href="/insights">Insights</A> for why each name is there. Compare the live book to
        the index over time, but give the strategy enough cycles to look like itself. And if
        you are building your own book alongside ours, size for your sleep — our risk budget
        is not yours.
      </P>

      <InlineCTA />

      <H2>Frequently asked questions</H2>
      <FAQList
        items={[
          {
            q: "When is a live track record 'real'?",
            a: "There is no magic day. We treat longer samples as more informative, especially across different market regimes. The first hundred days are necessary transparency, not a final verdict.",
          },
          {
            q: "Why not wait until the portfolio is fully built to show it?",
            a: "Because opacity is how track records get curated. Publishing while the book is young is messier and more honest.",
          },
          {
            q: "Should I copy positions one-for-one?",
            a: "No. Outpick is educational research. Use the notes to understand process and risk; construct and size your own portfolio with an advisor if needed.",
          },
        ]}
      />

      <Callout variant="warning" title="Educational disclaimer">
        <P>
          Past and early live performance are not indicative of future results. This essay is
          educational, not a recommendation to buy or sell any security.
        </P>
      </Callout>

      <KeyTakeaway>
        <P>
          The first hundred days of a live portfolio are for installing process under real
          marks — not for crowning a strategy. Read the theses, watch the cadence, and let
          time turn a short sample into a track record.
        </P>
      </KeyTakeaway>
    </Prose>
  ),
};

export default article;
