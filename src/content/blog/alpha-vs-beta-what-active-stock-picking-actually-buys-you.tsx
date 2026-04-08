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
    slug: "alpha-vs-beta-what-active-stock-picking-actually-buys-you",
    title: "Alpha vs beta: what active stock picking actually buys you",
    description:
      "Alpha vs beta in stock picking, explained without equations. Beta is cheap and indexable. Alpha is rare. Here is how to tell which one you are paying for.",
    keyword: "alpha vs beta in stock picking",
    keywords: [
      "alpha and beta investing",
      "active management alpha",
      "CAPM explained",
      "measuring portfolio alpha",
    ],
    publishedAt: "2026-04-07",
    category: "Education",
    tags: ["alpha", "beta", "active management"],
    readingTime: 8,
    author: "Outpick Research",
  },
  Content: () => (
    <Prose>
      <Lede>
        Every dollar you make in the stock market comes from one of two places &mdash; and understanding alpha vs beta in stock picking is the difference between paying for an edge and paying for the index in a fancier wrapper.
      </Lede>
      <TLDR>
        <P>
          Beta is the return you get from being exposed to the market. Alpha is the return you get from being right about something the market got wrong. Beta is cheap and indexable. Alpha is rare and worth paying for &mdash; if and only if your manager actually delivers it.
        </P>
      </TLDR>

      <H2>The two sources of return</H2>
      <P>
        Picture your portfolio&apos;s return as a number you can split into two parts. The first part is whatever the market did, scaled by how much market exposure you took. The second part is whatever your portfolio did <Strong>on top of</Strong> that. Finance people write this as <Strong>r = &alpha; + &beta;r<sub>m</sub></Strong>, but you can read it in plain English: your return equals "what the market gave you" plus "what you added or subtracted on your own."
      </P>
      <P>
        That second piece is alpha. It is the part of your performance that cannot be explained by simply riding the market up or down. If the S&amp;P 500 returned 10% in a year and your portfolio with similar risk returned 13%, you generated roughly 3 points of alpha. If you returned 7%, you generated roughly negative 3.
      </P>
      <P>
        Beta, on the other hand, is just sensitivity to the market. A portfolio with a beta of 1.0 moves one-for-one with the index. A beta of 1.3 means you go up 1.3% when the market goes up 1% &mdash; and down 1.3% when it falls. Beta is not skill. It is leverage to a thing that already exists.
      </P>

      <H2>Beta is cheap. Alpha is rare.</H2>
      <P>
        Here is the part the ETF revolution made impossible to ignore. You can now buy beta &mdash; pure exposure to the S&amp;P 500, the Nasdaq, MSCI World, you name it &mdash; for somewhere between 0.03% and 0.10% per year. That is less than the spread on a single trade in 1995. Beta has been commoditized. There is no longer any economic case for paying an active manager just to deliver the market return.
      </P>
      <P>
        The only honest reason to pay for active management is alpha. The problem is that alpha is, statistically, very hard to come by.
      </P>
      <Callout variant="warning" title="The SPIVA reality check">
        <P>
          Across the last 15 years of S&amp;P&apos;s SPIVA scorecards, roughly 90% of US large-cap active mutual funds have underperformed the S&amp;P 500 net of fees. The longer the window, the worse the numbers get. Most active managers do not just fail to deliver alpha &mdash; they deliver negative alpha after costs.
        </P>
      </Callout>
      <P>
        That stat is the entire reason indexing ate the world over the last twenty years. If 90% of professional managers cannot beat a cheap ETF, the rational default for most investors is the cheap ETF. The interesting question is what the other 10% are actually doing differently.
      </P>

      <H2>Why most active managers don&apos;t earn their fees</H2>
      <P>
        There are a few structural reasons the average active fund underperforms, and none of them are about the manager being stupid.
      </P>
      <UL>
        <LI><Strong>Closet indexing.</Strong> A 100-stock fund benchmarked against the S&amp;P 500 mathematically cannot deviate much from the index. Its alpha is bounded near zero before fees, and negative after.</LI>
        <LI><Strong>Fee drag.</Strong> A 1% expense ratio compounds. Over 20 years it costs roughly 18% of your terminal wealth. The manager has to outperform by 1% a year just to break even with the index.</LI>
        <LI><Strong>Career risk.</Strong> Professional managers get fired for trailing the benchmark in any single year, so they hug it. Hugging the benchmark guarantees you cannot beat it by much.</LI>
        <LI><Strong>Asset bloat.</Strong> A fund that gets too large can no longer take meaningful positions in its best ideas without moving prices against itself. Edge gets diluted by AUM.</LI>
      </UL>
      <P>
        Concentrated, smaller, high-conviction books are the structural opposite of all four of those problems &mdash; which is why the funds that <Strong>do</Strong> generate alpha tend to look the way they look. We covered the math of concentration in <A href="/blog/how-many-stocks-should-you-hold-to-beat-the-market">how many stocks should you hold to beat the market</A>.
      </P>

      <H2>What real alpha looks like</H2>
      <P>
        Outpick is small, concentrated, and benchmark-agnostic by design. Our walk-forward backtest covered the period from June 2022 through April 2026 and produced the following return profile against the S&amp;P 500.
      </P>
      <StatGrid
        stats={[
          { label: "OUTPICK CAGR", value: "+38.99%", green: true },
          { label: "S&P 500 (TOTAL)", value: "+83.34%" },
          { label: "ALPHA (3.8 YR)", value: "+167%", green: true },
          { label: "WALK-FORWARD ALPHA", value: "+67%", green: true },
        ]}
      />
      <P>
        The 167% number is the cumulative excess return over the S&amp;P 500 across the full backtest. The 67% is the alpha generated specifically in the out-of-sample walk-forward window from July 2024 onward &mdash; the part of the test where the strategy was making picks on data it had never seen during development. That second number matters far more than the first. If you want a deeper explanation of why, see our writeup on <A href="/blog/walk-forward-backtesting-explained">walk-forward backtesting explained</A>.
      </P>
      <P>
        A few additional numbers help frame the risk side of the equation: a Sharpe ratio of 1.14, a max drawdown of -27.38% in April 2025, and a 66% win rate across 132 trades. None of those numbers are magic. They are what you would expect from a concentrated long-only book that is willing to be wrong about a third of the time as long as the winners are big enough to carry the result.
      </P>
      <P>
        Outpick is educational research, not financial advice; past performance is not indicative of future results. Live trading with real money began on April 1, 2026 and is published in full on the <A href="/dashboard">dashboard</A>.
      </P>

      <H2>How Outpick generates alpha</H2>
      <P>
        Alpha does not come from one source. It comes from a few small edges layered on top of each other &mdash; none of them magic, all of them disciplined. Roughly:
      </P>
      <UL>
        <LI><Strong>Stock selection.</Strong> The single biggest contributor. Picks are screened for fundamentals (cash flow, balance sheet, returns on capital) before any technical or sentiment overlay.</LI>
        <LI><Strong>Factor tilts.</Strong> The book leans into well-documented factor premia: small-cap value, quality, and momentum. These are the factors that academic literature has shown deliver excess returns over decades, not quarters.</LI>
        <LI><Strong>Position sizing.</Strong> Equal-weight at entry, let winners run, never average down on a broken thesis. Eight stocks doubled during the backtest, and they did most of the work.</LI>
        <LI><Strong>Cadence and patience.</Strong> A new pick every two weeks (~26 a year). No reactive trading, no chasing headlines.</LI>
        <LI><Strong>Hard exits.</Strong> When a thesis breaks, the position closes. Holding losers is the most common alpha killer in long-only books.</LI>
      </UL>
      <Quote cite="Cliff Asness">
        Alpha is what is left over after you subtract everything you should have been able to predict.
      </Quote>
      <P>
        That definition is the right one to keep in mind. You only generated alpha if your return cannot be explained by your market exposure, your factor tilts, or your luck. The job of any honest active manager is to demonstrate that what is left over is real and repeatable.
      </P>

      <InlineCTA />

      <H2>How to measure your own alpha</H2>
      <P>
        You can do a rough version of this on a spreadsheet. The point is not to publish a paper &mdash; it is to find out whether you are actually adding anything by picking stocks at all.
      </P>
      <UL>
        <LI><Strong>Step 1.</Strong> Pull your portfolio&apos;s total return over the last 3-5 years.</LI>
        <LI><Strong>Step 2.</Strong> Pull the S&amp;P 500 (or whatever benchmark fits your risk profile) over the same window.</LI>
        <LI><Strong>Step 3.</Strong> Subtract. The difference is your raw excess return.</LI>
        <LI><Strong>Step 4.</Strong> Adjust for risk. If your portfolio was significantly more or less volatile than the benchmark, you were taking more or less beta &mdash; and that beta should explain part of the spread.</LI>
        <LI><Strong>Step 5.</Strong> Be honest about luck. A single year, even a single 5-year period, is not statistically conclusive. Alpha shows up over long stretches, not quarters.</LI>
      </UL>
      <P>
        If you want a cleaner way to think about the risk-adjustment step, our <A href="/blog/sharpe-ratio-explained-for-individual-investors">Sharpe ratio explainer</A> walks through the math without making it painful. And if your honest answer at the end of the exercise is "my alpha is roughly zero," that is not a failure &mdash; it is the most common result among professional investors. It just means a low-cost index fund is probably the right default, unless you are paying for someone whose alpha is real.
      </P>

      <H2>FAQ</H2>
      <FAQList
        items={[
          {
            q: "What is the difference between alpha and beta in investing?",
            a: "Beta is the return you get from being exposed to the market. Alpha is the return you get above and beyond what beta would have predicted. Beta you can buy with a 0.03% ETF. Alpha requires either skill or luck, and over long time horizons it is overwhelmingly skill that persists.",
          },
          {
            q: "Is alpha just luck?",
            a: "Some of it always is, especially over short windows. The way you separate skill from luck is sample size and out-of-sample testing. A manager who outperforms over five years on data they did not see during model development is much more likely to have real skill than one who outperforms in a single hot quarter.",
          },
          {
            q: "How long do you need to measure alpha to trust it?",
            a: "At least three to five years, ideally including a full bear market. Anything shorter is too noisy to draw conclusions from. The walk-forward portion of any track record — the period after the strategy was finalized — matters far more than the in-sample fit.",
          },
          {
            q: "Can a long-only portfolio generate alpha?",
            a: "Yes. You do not need short positions, leverage, or derivatives to generate alpha. You need a concentrated book, a real selection edge, and the discipline to let winners run while exiting broken theses. Outpick is long-only and generated +167% alpha across the backtest period.",
          },
          {
            q: "How does Outpick's alpha compare to typical active funds?",
            a: <>The SPIVA scorecards show ~90% of US large-cap active funds underperform the S&amp;P 500 over 15 years. Outpick&apos;s walk-forward backtest produced +67% alpha in the out-of-sample window alone. See the full numbers on the <A href="/dashboard">dashboard</A>.</>,
          },
        ]}
      />

      <KeyTakeaway>
        <P>
          Alpha vs beta in stock picking is the only framework that matters when you are deciding whether to pay for active management. Beta is cheap and you can buy it from any broker. Alpha is rare, hard to prove, and the only thing worth paying for &mdash; assuming the manager can actually demonstrate it out-of-sample.
        </P>
      </KeyTakeaway>
    </Prose>
  ),
};

export default article;
