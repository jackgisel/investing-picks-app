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
  CompareTable,
  InlineCTA,
  FAQList,
  TLDR,
} from "@/components/blog/prose";

const article: Article = {
  meta: {
    slug: "sharpe-ratio-explained-for-individual-investors",
    title:
      "Sharpe ratio explained: what it is, why it matters, and what good looks like",
    description:
      "What is the Sharpe ratio in investing? A plain-English explainer of the math, what counts as 'good', and why it's the single number every long-term investor should track.",
    keyword: "what is sharpe ratio in investing",
    keywords: [
      "sharpe ratio explained",
      "good sharpe ratio",
      "risk adjusted return",
      "sharpe ratio formula",
    ],
    publishedAt: "2026-04-07",
    category: "Education",
    tags: ["sharpe ratio", "risk-adjusted return", "metrics"],
    readingTime: 7,
    author: "Outpick Research",
  },
  Content: () => (
    <Prose>
      <Lede>
        If you only learn one number from finance, learn this one: the Sharpe
        ratio tells you how much return you actually earned for the bumps you
        had to live through.
      </Lede>

      <TLDR>
        <P>
          The Sharpe ratio measures return per unit of volatility. Anything
          above 1.0 is genuinely good, above 2.0 is exceptional, and the long-run
          S&amp;P 500 sits closer to 0.4-0.5. It matters more than raw return
          because high-Sharpe portfolios are the ones investors actually stick
          with through drawdowns.
        </P>
      </TLDR>

      <H2>What is the Sharpe ratio in investing?</H2>
      <P>
        The Sharpe ratio, named after Nobel laureate William F. Sharpe, is a
        single number that answers a deceptively simple question:{" "}
        <Strong>
          how much extra return did this portfolio earn for every unit of risk
          it took?
        </Strong>{" "}
        Two portfolios can post identical returns over the same year, but if one
        of them got there with smooth, steady gains and the other rode a
        rollercoaster of 30% drawdowns, those are very different products. The
        Sharpe ratio is how we tell them apart.
      </P>
      <P>
        For an individual investor trying to evaluate a stock-picks newsletter,
        a fund, or your own portfolio, asking{" "}
        <Strong>what is the Sharpe ratio in investing</Strong> is really asking{" "}
        a more practical question: was the return I earned worth the stress I
        endured to earn it? A high Sharpe means yes. A low Sharpe means you
        could have gotten roughly the same outcome from a much calmer strategy.
      </P>

      <H2>The formula in plain English</H2>
      <P>
        The math is less intimidating than it looks. The Sharpe ratio equals
        your portfolio&apos;s return, minus the risk-free rate, divided by the
        standard deviation of your portfolio&apos;s returns. In plain English:
      </P>
      <UL>
        <LI>
          <Strong>Excess return</Strong> is what you earned above what a
          totally safe asset (like a Treasury bill) would have paid you. If your
          portfolio earned 12% and T-bills paid 4%, your excess return is 8%.
        </LI>
        <LI>
          <Strong>Standard deviation</Strong> is a statistical measure of how
          much your returns wobble around their average. A portfolio that
          returns exactly 1% every month has a standard deviation near zero. A
          portfolio that swings between +15% and -10% months has a high one.
        </LI>
        <LI>
          <Strong>The ratio</Strong> divides reward by wobble. Bigger numerator
          (more excess return) and smaller denominator (less wobble) both push
          the Sharpe up.
        </LI>
      </UL>
      <P>
        That&apos;s it. The genius of the metric is that it forces apples-to-apples
        comparisons. You can&apos;t fake a high Sharpe ratio by simply taking
        more risk, because the denominator punishes you for it.
      </P>

      <H2>A worked example: same return, very different Sharpes</H2>
      <P>
        Imagine two long-term portfolios that both happen to earn 15% annualized
        over the same period. Portfolio A is a focused, well-constructed basket
        of high-quality businesses with relatively stable earnings. Portfolio B
        is a concentrated, leveraged punt on speculative names that whipsaws
        violently. Same headline number, very different experience.
      </P>
      <CompareTable
        headers={["", "Portfolio A", "Portfolio B"]}
        rows={[
          ["Annualized return", "15%", "15%"],
          ["Risk-free rate", "4%", "4%"],
          ["Excess return", "11%", "11%"],
          ["Standard deviation", "10%", "25%"],
          ["Sharpe ratio", "1.10", "0.44"],
        ]}
      />
      <P>
        Portfolio A&apos;s Sharpe of 1.10 is genuinely impressive. Portfolio
        B&apos;s 0.44 tells you the same return came at more than double the
        volatility — and in real life, almost no investor would have actually
        held Portfolio B through its drawdowns. They&apos;d have sold near the
        bottom and missed the recovery. The Sharpe ratio is, in a sense, a
        measure of how survivable a strategy is.
      </P>

      <H2>What counts as a good Sharpe ratio?</H2>
      <P>
        Here is a rough rule of thumb that practitioners use, and it applies
        reasonably well to long-only equity portfolios over multi-year windows:
      </P>
      <UL>
        <LI>
          <Strong>Below 0.5:</Strong> mediocre. You took meaningful risk and
          didn&apos;t get paid much for it.
        </LI>
        <LI>
          <Strong>0.5 to 1.0:</Strong> acceptable. This is where most diversified
          equity strategies live.
        </LI>
        <LI>
          <Strong>1.0 to 2.0:</Strong> good to very good. Genuinely
          risk-efficient, hard to achieve consistently.
        </LI>
        <LI>
          <Strong>Above 2.0:</Strong> exceptional, and rare outside short
          windows or quant strategies that exploit specific inefficiencies.
        </LI>
      </UL>
      <P>
        Reality check: most long-only equity portfolios spend their lives
        between 0.4 and 0.8. The S&amp;P 500&apos;s long-run Sharpe ratio is
        roughly 0.4-0.5 depending on the window you measure. That isn&apos;t a
        criticism of the index — it just reflects the fact that broad equity
        markets are volatile, and the long-run premium over bonds, while real,
        comes with significant year-to-year noise.
      </P>
      <Callout variant="info" title="Why this matters">
        <P>
          When someone advertises a strategy with a 25% return, your first
          question should be &quot;at what Sharpe?&quot; A 25% return at a Sharpe
          of 0.6 is a story about taking enormous risk and getting lucky. A 25%
          return at a Sharpe of 1.5 is a story about a genuinely well-built
          process.
        </P>
      </Callout>

      <H2>How Outpick&apos;s Sharpe stacks up</H2>
      <P>
        Our walk-forward backtest of the Outpick stock-picks strategy from June
        2022 through April 2026 produced a Sharpe ratio of 1.14. To put that in
        context, it sits in the &quot;good&quot; band described above, and is
        meaningfully higher than the long-run S&amp;P 500 Sharpe over comparable
        windows. The CAGR over that same period was 38.99%, with a maximum
        drawdown of 27.38%. You can see the full track record on our{" "}
        <A href="/#track-record">track record page</A>.
      </P>
      <StatGrid
        stats={[
          { label: "BACKTEST CAGR", value: "+38.99%", green: true },
          { label: "SHARPE RATIO", value: "1.14", green: true },
          { label: "MAX DRAWDOWN", value: "-27.38%" },
        ]}
      />
      <P>
        That Sharpe of 1.14 is the number we&apos;re proudest of. The CAGR is
        what catches the eye, but the Sharpe is what tells you the CAGR
        wasn&apos;t bought with reckless concentration. For a deeper look at how
        risk-adjusted returns relate to active stock picking, see our piece on{" "}
        <A href="/blog/alpha-vs-beta-what-active-stock-picking-actually-buys-you">
          alpha vs beta
        </A>
        .
      </P>

      <H2>Why Sharpe matters more than raw return</H2>
      <P>
        Raw return is the metric that sells newsletters. Sharpe ratio is the
        metric that builds wealth. The reason is psychological as much as
        mathematical: the strategies investors actually stick with for ten or
        twenty years are the ones whose drawdowns don&apos;t shake them out.
        High-Sharpe portfolios are, by construction, less likely to put you
        through a drawdown so deep that you sell at the worst possible moment.
      </P>
      <P>
        Compounding is the eighth wonder of the world, but only if you stay
        invested. A portfolio with a beautiful 30% headline CAGR and a Sharpe of
        0.4 will, in practice, deliver far less to most investors than a 15%
        CAGR portfolio with a Sharpe of 1.0, because the second one is one
        people can hold through the cycle. This is also why we wrote about{" "}
        <A href="/blog/how-to-beat-the-sp-500-without-becoming-a-day-trader">
          beating the S&amp;P 500 without becoming a day trader
        </A>{" "}
        — the goal isn&apos;t excitement, it&apos;s a process you can live with
        for a decade.
      </P>

      <InlineCTA />

      <H2>How to calculate your own Sharpe ratio</H2>
      <P>
        You don&apos;t need a quant degree. If you have monthly returns for your
        portfolio in a spreadsheet, here&apos;s the simplest version:
      </P>
      <UL>
        <LI>
          Subtract the monthly risk-free rate (use the 1-month Treasury yield
          divided by 12) from each month&apos;s return to get monthly excess
          returns.
        </LI>
        <LI>
          Take the average of those monthly excess returns and multiply by 12 to
          annualize.
        </LI>
        <LI>
          Take the standard deviation of the monthly excess returns and multiply
          by the square root of 12 to annualize.
        </LI>
        <LI>
          Divide the annualized excess return by the annualized standard
          deviation. That&apos;s your Sharpe.
        </LI>
      </UL>
      <P>
        If you do this for your own holdings and get something below 0.5, it
        doesn&apos;t necessarily mean your strategy is bad — your sample might
        be too short, or you might be measuring through a particularly rough
        period. But it should prompt a real question about whether the risk
        you&apos;re taking is being rewarded. Track it over years, not quarters.
        You can also check it against the live Outpick portfolio in your{" "}
        <A href="/dashboard">dashboard</A>.
      </P>

      <H2>Frequently asked questions</H2>
      <FAQList
        items={[
          {
            q: "What is a good Sharpe ratio for an individual investor?",
            a: "Anything above 1.0 over a multi-year window is genuinely good for a long-only equity portfolio. Most diversified retail portfolios land between 0.4 and 0.8. Above 2.0 is exceptional and usually only sustainable in specialized quant strategies, not buy-and-hold equities.",
          },
          {
            q: "Is the Sharpe ratio the same as the Sortino ratio?",
            a: "No. The Sortino ratio is a close cousin that only penalizes downside volatility, on the theory that upside swings shouldn't count as risk. Sortino tends to be higher than Sharpe for the same portfolio. Sharpe is more widely reported and easier to compare across sources.",
          },
          {
            q: "Can a portfolio have a negative Sharpe ratio?",
            a: "Yes. If your portfolio's return is below the risk-free rate, your excess return is negative, so the Sharpe ratio is negative. It means you would have been better off holding T-bills. This happens to plenty of strategies during bear markets.",
          },
          {
            q: "Why does the S&P 500 have such a low long-run Sharpe ratio?",
            a: "Because broad equity markets are inherently volatile. The S&P 500 has delivered a strong long-run premium over bonds, but it gets there through bear markets, recessions, and flash crashes. Roughly 0.4-0.5 over multi-decade windows is a good benchmark — beating it consistently is harder than it sounds.",
          },
          {
            q: "Should I pick a fund based on Sharpe ratio alone?",
            a: "No single metric is enough. Sharpe should be paired with maximum drawdown, win rate, and an honest look at the methodology behind the returns. But if forced to pick one number, Sharpe tells you more than raw return ever will.",
          },
        ]}
      />

      <Callout variant="warning" title="Educational disclaimer">
        <P>
          This article is for educational purposes only and is not investment
          advice. Past performance, including backtested results, does not
          guarantee future returns. Always do your own research or consult a
          licensed financial advisor before making investment decisions.
        </P>
      </Callout>

      <KeyTakeaway>
        <P>
          The Sharpe ratio is the closest thing investing has to a single
          honesty score. It rewards return, punishes wobble, and lets you
          compare strategies on a level field. Track it for your own portfolio,
          demand it from anyone selling you a strategy, and weight it more
          heavily than raw return when you decide where your capital lives.
        </P>
      </KeyTakeaway>
    </Prose>
  ),
};

export default article;
