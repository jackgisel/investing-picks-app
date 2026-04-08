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
  CompareTable,
  Quote,
  InlineCTA,
  FAQList,
  TLDR,
} from "@/components/blog/prose";

const article: Article = {
  meta: {
    slug: "how-many-stocks-should-you-hold-to-beat-the-market",
    title: "How many stocks should you hold to beat the market?",
    description:
      "How many stocks should you hold to beat the market? The math says 15-25. Fewer and you take uncompensated risk. More and you become the index.",
    keyword: "how many stocks should you hold to beat the market",
    keywords: [
      "portfolio concentration",
      "diversification curve",
      "active portfolio size",
      "position sizing",
    ],
    publishedAt: "2026-04-07",
    category: "Education",
    tags: ["portfolio construction", "diversification", "concentration"],
    readingTime: 8,
    author: "Outpick Research",
  },
  Content: () => (
    <Prose>
      <Lede>
        If you want to beat the market, the question of how many stocks you should hold to beat the market is not a matter of taste &mdash; it is a matter of math.
      </Lede>
      <TLDR>
        <P>
          Holding ~16-20 stocks eliminates roughly 88% of the diversifiable risk of a single name. Beyond that, each additional stock dilutes your edge faster than it reduces your risk. Concentrated active portfolios live in the 15-25 stock range for a reason: it is the only band where stock picking can actually move the needle versus the S&amp;P 500.
        </P>
      </TLDR>

      <H2>The diversification curve</H2>
      <P>
        Modern portfolio theory has one chart everyone should see once. Plot the number of stocks in a portfolio on the x-axis and the percentage of unsystematic (stock-specific) risk eliminated on the y-axis. The curve rises steeply at first, then flattens fast. A single stock leaves you fully exposed to one company&apos;s blow-ups. Five names cut that idiosyncratic risk by more than half. By the time you own twenty, you have captured almost all the diversification benefit there is.
      </P>
      <P>
        The numbers are remarkably stable across decades of academic work, going back to Evans &amp; Archer (1968) and refined many times since. Here is the rough shape of the curve.
      </P>
      <CompareTable
        headers={["Number of stocks", "Unsystematic risk eliminated"]}
        rows={[
          ["1", "0%"],
          ["5", "~60%"],
          ["10", "~80%"],
          ["20", "~88%"],
          ["50", "~92%"],
          ["100", "~95%"],
          ["500 (S&P 500)", "~99%"],
        ]}
      />
      <P>
        The takeaway: the jump from 1 to 20 stocks is enormous. The jump from 20 to 100 is tiny. And the jump from 100 to 500 is essentially noise. You do not need to own everything to be diversified &mdash; you need to own the right twenty.
      </P>

      <H2>Why owning 100 stocks is just buying the index</H2>
      <P>
        Here is the part most retail investors miss. Once you own 100+ names selected from the same large-cap universe as the S&amp;P 500, your portfolio&apos;s return is mathematically going to look almost identical to the S&amp;P 500&apos;s return. You have <Strong>become</Strong> the index. The only difference is that you are paying transaction costs, juggling tax lots, and probably charging yourself a management fee for the privilege.
      </P>
      <P>
        This is the dirty secret of "diversified" actively managed mutual funds. A fund holding 150 large-cap US stocks is not picking stocks in any meaningful sense &mdash; it is closet indexing. Its top ten holdings are usually the same mega-caps that dominate the S&amp;P 500. Its tracking error is small. Its alpha is, predictably, also small or negative once fees are deducted.
      </P>
      <Callout variant="warning" title="Closet indexing tax">
        <P>
          A 100-stock active fund charging 0.8% a year is essentially selling you the index plus a guaranteed 80 basis points of underperformance. The math does not care how good the manager&apos;s ideas are &mdash; the ideas get drowned in the noise of 99 other positions.
        </P>
      </Callout>

      <H2>The 15-25 sweet spot</H2>
      <P>
        Concentration is the only way active picking can move the needle. If your best idea is 5% of the portfolio, a 100% gain on that idea adds 5% to your total return. If your best idea is 0.5% of the portfolio, that same 100% gain adds 0.5%. The math is brutal and unavoidable.
      </P>
      <P>
        Buffett has been blunt about this for decades.
      </P>
      <Quote cite="Warren Buffett">
        Diversification is protection against ignorance. It makes very little sense for those who know what they are doing.
      </Quote>
      <P>
        Charlie Munger said the same thing in fewer words: a few good decisions, made carefully, drive the entire result. The Berkshire equity book is famously concentrated &mdash; for most of its history, the top five holdings have made up the majority of the portfolio.
      </P>
      <P>
        The 15-25 stock band is where you get nearly all the diversification benefit (88-90% of unsystematic risk gone) while still leaving each position big enough to matter. It is not a coincidence that this is the range most concentrated value funds, family offices, and disciplined long-only managers settle into. For a deeper look at the active-vs-passive math, see our breakdown of <A href="/blog/how-to-outperform-the-sp-500-with-stock-picks">how to outperform the S&amp;P 500 with stock picks</A>.
      </P>

      <H2>Position sizing rules</H2>
      <P>
        Knowing the right number of stocks is half the answer. The other half is how big each one should be. There are a few rules we follow that almost any concentrated investor would recognize.
      </P>
      <UL>
        <LI><Strong>Start equal-weight.</Strong> A new pick enters the book at roughly 4-6%. You do not actually know which idea will be the winner, so handicapping at entry is mostly false confidence.</LI>
        <LI><Strong>Let winners run.</Strong> If a position doubles, do not trim mechanically. The big winners are what carry the portfolio &mdash; in our backtest, eight stocks doubled and they did almost all of the heavy lifting. Cutting them early is the single most expensive mistake an active investor makes.</LI>
        <LI><Strong>Cap any position at ~12-15%.</Strong> Past that you are taking single-name risk that one bad earnings call can erase a year of work.</LI>
        <LI><Strong>Never average down on a thesis-broken loser.</Strong> Adding to a falling stock is only correct if the fundamentals are intact and the price has improved. If the original thesis is broken, doubling down is just doubling the mistake.</LI>
        <LI><Strong>Cut losers small.</Strong> A 25-30% drawdown on a single name should trigger a fresh review, not an automatic add.</LI>
      </UL>

      <H2>What our portfolio looks like</H2>
      <P>
        Outpick ended its 3.8-year walk-forward backtest holding 16 names. That number was not a target &mdash; it is what fell out of the process. We publish a new pick every two weeks (~26 a year), exit positions when the thesis breaks or the valuation runs ahead of the fundamentals, and let winners compound. Over time the book naturally settles in the high teens.
      </P>
      <CompareTable
        headers={["Metric", "S&P 500", "Outpick (backtest)"]}
        rows={[
          ["Period", "Jun 2022 – Apr 2026", "Jun 2022 – Apr 2026"],
          ["Total return", "+83.34%", "+250.39%"],
          ["CAGR", "~17%", "+38.99%"],
          ["Max drawdown", "~-25%", "-27.38%"],
          ["Holdings", "500", "16"],
        ]}
      />
      <P>
        The drawdown numbers are worth noting. A 16-stock book is not dramatically more volatile than the S&amp;P 500 over a multi-year window &mdash; you give up a couple of points of downside protection in exchange for a much larger return profile. That trade is the entire point of active management. For more on whether that trade is worth paying for, see <A href="/blog/is-paying-for-a-stock-picking-service-worth-it">is paying for a stock picking service worth it</A>.
      </P>
      <P>
        Outpick is educational research, not financial advice; past performance is not indicative of future results. The walk-forward backtest is published in full on our <A href="/dashboard">dashboard</A> alongside the live portfolio that began trading real money on April 1, 2026.
      </P>

      <InlineCTA />

      <H2>When to rebalance</H2>
      <P>
        Concentrated portfolios should be rebalanced rarely and reluctantly. The instinct to "trim winners and add to losers" sounds prudent and is one of the most reliable ways to destroy long-term returns. The point of holding fewer stocks is to let the winners do their job. A reasonable cadence:
      </P>
      <UL>
        <LI><Strong>Every new pick</Strong> &mdash; rebalance only the new entry, not the existing book.</LI>
        <LI><Strong>When a thesis breaks</Strong> &mdash; exit fully, do not "size down."</LI>
        <LI><Strong>When a position exceeds ~15%</Strong> &mdash; trim the excess, leave the core.</LI>
        <LI><Strong>Annually, at most</Strong> &mdash; for tax-loss harvesting, not for cosmetic balance.</LI>
      </UL>
      <P>
        Everything else is overtrading dressed up as discipline. If you want to see how this plays out in a single sector that has driven outsized returns, our writeup on <A href="/blog/small-cap-stocks-that-beat-the-sp-500">small cap stocks that beat the S&amp;P 500</A> walks through specific examples.
      </P>

      <H2>FAQ</H2>
      <FAQList
        items={[
          {
            q: "Is 30 stocks too many for an active portfolio?",
            a: "Thirty is the upper edge. You are still picking, but each name only contributes ~3.3% on average, which dilutes your conviction picks. Most disciplined active managers settle in the 15-25 range because that is where stock selection still meaningfully drives returns.",
          },
          {
            q: "What is the minimum number of stocks to be diversified?",
            a: "Roughly 15-20 stocks across at least a few sectors gets you ~88-90% of the diversification benefit available from owning the entire market. Below 10 you start taking meaningful idiosyncratic risk that the market does not pay you to hold.",
          },
          {
            q: "Can you beat the market with just 5 stocks?",
            a: "Yes, but the variance is huge. Five-stock portfolios have wider distributions of outcomes in both directions. You can dramatically beat the market or dramatically lag it, often in the same year. Unless you have very high conviction and a very long time horizon, the risk-adjusted return suffers.",
          },
          {
            q: "How does Outpick decide position sizes?",
            a: "New picks enter the book at roughly equal weight (4-6%). We do not actively trim winners until they exceed ~15% of the portfolio. We exit losers when the underlying thesis breaks rather than averaging down. The result is a book of ~16 names where the top performers are allowed to compound.",
          },
          {
            q: "Does holding fewer stocks mean higher risk?",
            a: "It means higher single-name risk and lower diversifiable risk benefit. But systematic (market) risk is identical — both a 16-stock and a 500-stock portfolio crash in 2008. The active question is whether the additional stock-specific risk is compensated by alpha. For a manager who actually has an edge, yes. For one who does not, no.",
          },
        ]}
      />

      <KeyTakeaway>
        <P>
          The honest answer to how many stocks you should hold to beat the market is 15-25. Fewer and you are taking uncompensated single-name risk. More and you are paying active fees to own the index. The diversification curve flattens fast &mdash; what matters after that is whether your picks are actually any good.
        </P>
      </KeyTakeaway>
    </Prose>
  ),
};

export default article;
