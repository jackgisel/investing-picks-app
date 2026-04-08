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
  StatGrid,
  Quote,
  InlineCTA,
  FAQList,
  TLDR,
} from "@/components/blog/prose";

const article: Article = {
  meta: {
    slug: "how-to-find-10x-stocks-as-a-long-term-investor",
    title: "How to find 10x stocks (and why you only need a few)",
    description:
      "How to find 10x stocks for long term investors: the math of asymmetric upside, the patterns we screen for, and a real 5-bagger from our live portfolio.",
    keyword: "how to find 10x stocks for long term investors",
    keywords: [
      "10-bagger stocks",
      "asymmetric upside investing",
      "Peter Lynch stock picking",
      "concentrated portfolio strategy",
    ],
    publishedAt: "2026-04-07",
    category: "Research",
    tags: ["10x", "growth", "asymmetric upside"],
    readingTime: 8,
    author: "Outpick Research",
  },
  Content: () => (
    <Prose>
      <Lede>
        You don&apos;t need to be right often to beat the market — you need to be
        right big, and the math is less mysterious than most investors think.
      </Lede>

      <TLDR>
        <P>
          In a 25-stock portfolio, just two true 10-baggers held to maturity drag
          the whole fund past the S&amp;P 500 regardless of what the other 23
          positions do. That&apos;s the entire case for concentrated long-term
          investing. The hard part isn&apos;t the math — it&apos;s the patience.
        </P>
      </TLDR>

      <H2>The math of one 10x stock</H2>
      <P>
        Imagine a 25-stock portfolio with equal weights. Each position starts as
        4% of the book. Now suppose one of them becomes a 10-bagger over five
        years while everything else goes absolutely nowhere — not up, not down,
        flat.
      </P>
      <P>
        That single position alone now represents 40% of the original capital.
        The portfolio has returned roughly 36% over five years from one stock
        doing the work. Add a second 10x, and you&apos;re at 72% total return.
        Over the same period, a flat-to-sideways S&amp;P 500 would deliver maybe
        25%. You&apos;ve beaten the index with twenty-three failures and two
        winners.
      </P>
      <P>
        That is the entire philosophical case for how to find 10x stocks for long
        term investors: you are not trying to be right all the time. You are
        trying to own something that, when you are right, is right by an order of
        magnitude. Peter Lynch built a career on this insight.
      </P>

      <Quote cite="Peter Lynch, One Up on Wall Street">
        All you have to do is find a few good ones in your lifetime. You don&apos;t
        need a lot of winners, you need big winners.
      </Quote>

      <H2>Why diversification kills 10-baggers</H2>
      <P>
        Here is the uncomfortable corollary. If you own 200 stocks, no single
        10-bagger meaningfully moves your portfolio. A 10x on a 0.5% position adds
        4.5% of total return over the whole holding period. You have effectively
        neutered the one weapon that beats an index fund.
      </P>
      <P>
        This is why truly concentrated portfolios — 15 to 40 names — have the
        structural capacity to outperform. Not because concentration guarantees
        returns; it doesn&apos;t. But because it preserves the slugging percentage
        on your biggest winners. Outpick runs roughly 25-35 live positions at any
        time, which is deliberate. For the broader argument on position count, see{" "}
        <A href="/blog/how-many-stocks-should-you-hold-to-beat-the-market">
          how many stocks you should hold to beat the market
        </A>
        .
      </P>

      <Callout variant="info" title="The tradeoff is real">
        <P>
          Concentration cuts both ways. The same math that amplifies winners also
          amplifies losers. A -50% move in a 5% position costs 2.5% of total
          equity. The only defense is position selection quality and the
          willingness to hold through volatility.
        </P>
      </Callout>

      <H2>Patterns we look for</H2>
      <P>
        We&apos;ve found, across a 3.8-year walk-forward backtest that produced
        eight doublers from 132 trades, that 10x candidates tend to share a
        recognizable fingerprint. None of these patterns individually guarantee
        anything. Together they move the odds.
      </P>
      <UL>
        <LI>
          <Strong>Small market cap with accelerating earnings.</Strong> Hard to
          10x a $500B company. Easy math on a $2B company that doubles earnings
          three years in a row.
        </LI>
        <LI>
          <Strong>Founder-led or high insider ownership.</Strong> Operators who
          own the business make different decisions than hired CEOs managing
          quarterly optics.
        </LI>
        <LI>
          <Strong>Niche moat.</Strong> A defensible position in a small market is
          worth more than an undifferentiated position in a big one.
        </LI>
        <LI>
          <Strong>Ignored by sell-side.</Strong> Under 5 analyst ratings, often
          zero. No coverage means no institutional bid, which means valuations
          stay reasonable.
        </LI>
        <LI>
          <Strong>Post-drawdown setup.</Strong> Many 10-baggers are bought after
          a brutal 40-60% decline when the crowd has given up but the fundamentals
          have quietly improved.
        </LI>
        <LI>
          <Strong>Optionality.</Strong> A secondary business line or geographic
          expansion that isn&apos;t priced in. Free upside on top of the base case.
        </LI>
      </UL>

      <H2>Case study: a 5-bagger in 2 years</H2>
      <P>
        <Strong>CRS (Carpenter Technology)</Strong> is the closest thing in our
        live portfolio to a textbook case study. We bought it on January 2, 2024
        at $68.49 — a roughly $3.3B market cap specialty-alloys business that
        makes premium aerospace-grade materials with pricing power that most
        metals companies can only dream about. Two years and three months later
        it trades at $390.86.
      </P>

      <StatGrid
        stats={[
          { label: "CRS ENTRY", value: "$68.49" },
          { label: "CRS LAST", value: "$390.86", green: true },
          { label: "RETURN", value: "+470.68%", green: true },
          { label: "HOLDING PERIOD", value: "~2.3 YEARS" },
        ]}
      />

      <P>
        The fingerprint matches the pattern list almost line by line. Small-mid
        cap. Multi-year aerospace demand tailwind. A niche process moat in premium
        alloys that new entrants can&apos;t easily replicate. Barely covered by
        mainstream sell-side. Expanding margins that compounded into a multiple
        re-rating. One position does not make a strategy — but it shows the math
        works in live markets, not just in academic back-tests.
      </P>
      <P>
        Across our walk-forward backtest period (June 2022 - April 2026),{" "}
        <Strong>eight of our closed positions doubled or better</Strong>. Names
        like YPF (+199.87%), TGS (+189.83%), BMA (+179.01%), IRS (+160.98%), and
        AVGO (+128.40%) made up most of the alpha. These aren&apos;t unicorns.
        They are the direct output of a disciplined screen applied biweekly.
      </P>

      <H2>The patience cost</H2>
      <P>
        Here is what almost no one tells you about 10x stocks: they take years.
        Usually three to seven. And they go down a lot on the way up. CRS had a
        drawdown of roughly 25% between its entry and current price. Our full
        portfolio had a <Strong>-27.38% max drawdown in April 2025</Strong>.
        Individual names can be worse.
      </P>
      <P>
        Most investors who go looking for 10-baggers never actually find one
        because they sell during the scary parts. A position at +40% that
        retraces to +5% feels like a failure. Three quarters of slowing headline
        growth feels like the end of the thesis. You have to learn, sometimes
        painfully, to distinguish between a broken business and a temporary
        rerating.
      </P>
      <P>
        The Outpick approach is explicit about this: we publish the thesis, the
        entry, and then we hold. If a position goes -30% but the fundamentals
        still validate the thesis, we don&apos;t touch it. That discipline is why
        CRS is still in the book at +470% instead of being sold at +40% two years
        ago. For the theory behind not trading your way out of it, see{" "}
        <A href="/blog/how-to-beat-the-sp-500-without-becoming-a-day-trader">
          how to beat the S&amp;P 500 without becoming a day trader
        </A>
        .
      </P>

      <InlineCTA />

      <H2>What an actual 10x portfolio looks like</H2>
      <P>
        A realistic concentrated portfolio targeting asymmetric upside has a few
        shared characteristics. Twenty to thirty-five positions. Roughly equal
        starting weights, allowed to run — winners become larger by appreciation,
        not by rebalancing. Multi-year hold periods. Deliberate exposure to
        small and mid caps where the math actually allows a 10x. And a tolerance
        for 20-30% drawdowns at the portfolio level because that&apos;s what the
        upside costs.
      </P>
      <P>
        Over our walk-forward backtest, that structure produced{" "}
        <Strong>+38.99% CAGR against the S&amp;P 500&apos;s +83.34% total</Strong>{" "}
        for the same period — an alpha of +167% over 3.8 years. You can see the
        live portfolio on the <A href="/dashboard">dashboard</A> and the full
        methodology on the <A href="/#track-record">track record page</A>.
      </P>

      <FAQList
        items={[
          {
            q: "How rare are 10x stocks really?",
            a: "Less rare than most investors think. In our 3.8-year backtest, 8 of 132 trades doubled and a handful went much further. The rarity isn't finding them — it's holding them long enough. Most investors sell their biggest future winners at +50% because they don't yet know what they're sitting on.",
          },
          {
            q: "How long do you have to hold to find a 10-bagger?",
            a: "Historically, three to seven years is the typical window. Our CRS position is up 470% in roughly 2.3 years, which is fast. YPF took about 14 months to deliver +199%. Most take longer. If you need capital back in 18 months, this isn't the strategy for that capital.",
          },
          {
            q: "What percentage of my portfolio should I put in a single 10x candidate?",
            a: "Start positions at roughly 3% to 5% of the active portfolio. Let winners run and become larger through appreciation, not through adding. If you're starting a single name at more than 5% of net worth, you're taking idiosyncratic risk most investors shouldn't carry.",
          },
          {
            q: "Can you find 10x stocks in large caps?",
            a: (
              <>
                It&apos;s possible but much harder — AVGO was one of our rare
                mid-to-large-cap 2x+ names. The math is brutal: a $1T company
                10xing becomes larger than the entire S&amp;P 500. You will find
                far more 10-baggers in the $500M-$5B range. See{" "}
                <A href="/blog/small-cap-stocks-that-beat-the-sp-500">
                  small cap stocks that beat the S&amp;P 500
                </A>{" "}
                for why that bucket is structurally advantaged.
              </>
            ),
          },
        ]}
      />

      <KeyTakeaway>
        <P>
          How to find 10x stocks for long term investors comes down to three
          things: a screen that biases toward small caps with real business
          momentum, a concentrated portfolio that preserves the slugging
          percentage on winners, and the patience to hold through drawdowns you
          didn&apos;t sign up for. Outpick is educational research, not financial
          advice; past performance is not indicative of future results.
        </P>
      </KeyTakeaway>
    </Prose>
  ),
};

export default article;
