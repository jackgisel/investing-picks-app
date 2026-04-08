import type { Article } from "@/lib/blog";
import {
  Prose,
  Lede,
  H2,
  P,
  UL,
  OL,
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
    slug: "is-paying-for-a-stock-picking-service-worth-it",
    title: "Is paying for a stock picking service actually worth it? (the math)",
    description:
      "The honest break-even math on paying for stock picks. When the fee earns its keep, when it doesn't, and how to calculate the alpha you actually need.",
    keyword: "is paying for a stock picking service worth it",
    keywords: [
      "stock picking service roi",
      "stock picking service fees",
      "break even alpha calculation",
    ],
    publishedAt: "2026-04-07",
    category: "Education",
    tags: ["roi", "stock picking", "fees"],
    readingTime: 8,
    author: "Outpick Research",
  },
  Content: () => (
    <Prose>
      <Lede>
        The question &quot;is paying for a stock picking service worth it&quot;
        has a clean mathematical answer — and it depends almost entirely on
        the size of your portfolio.
      </Lede>

      <TLDR>
        <P>
          A stock picking service is worth it when the alpha it delivers, in
          dollars, exceeds the fee plus your time cost. At a $100k portfolio,
          a $1,000 annual subscription needs to add roughly 1% of extra
          return — a low bar for a legitimate strategy. At $5k, the same fee
          requires a 20% alpha, which is unrealistic and almost always
          dilutive.
        </P>
      </TLDR>

      <H2>The break-even formula</H2>
      <P>
        Strip away the marketing and the decision reduces to one equation.
        Before you pay for any picking service, calculate this number:
      </P>
      <P>
        <Strong>Break-even alpha = annual fee / portfolio size</Strong>
      </P>
      <P>
        That is the percentage of additional return the service has to deliver
        — on top of whatever you would have earned passively — just to cover
        its own cost. Below that number you are losing money on the
        subscription. Above it, you are net positive. The formula ignores
        taxes and time costs, which we will layer in shortly, but the core is
        this simple.
      </P>
      <P>
        The trap most prospective subscribers fall into is comparing the fee
        to the headline return. A service claiming 30% annual returns sounds
        like a bargain next to a $1,000 fee — but if the S&amp;P 500 returned
        25% that year, the service only delivered 5% of actual alpha. And on a
        $10k portfolio, that 5% alpha is $500 — half the fee.
      </P>

      <H2>Worked example: a $100k portfolio</H2>
      <P>
        Take a concrete case. You have $100,000 invested. A stock picking
        service costs $1,000 a year. Your alternative is buying a low-cost
        S&amp;P 500 index fund that charges about 0.03% in expense ratio. The
        math looks like this:
      </P>

      <OL>
        <li>
          Baseline: $100k in an index fund at +10% a year is +$10,000, minus
          $30 in fees. Net: +$9,970.
        </li>
        <li>
          With a picking service: the portfolio needs to finish at +$10,970 or
          higher to break even after the $1,000 fee. That is a 10.97% return —
          just 0.97% of alpha over the index.
        </li>
        <li>
          Anything above that 0.97% is pure profit from the subscription.
        </li>
      </OL>

      <P>
        Less than one percent. That is the alpha hurdle at $100k. For
        perspective, our{" "}
        <A href="/#track-record">walk-forward backtest</A> ran from June 2022
        through April 2026 and generated roughly 21% of alpha per year relative
        to the S&amp;P 500. We are not promising that number going forward, and{" "}
        <A href="/blog/walk-forward-backtesting-explained">
          backtests are not guarantees
        </A>
        , but the point is structural: a 1% hurdle is easy for a real edge to
        clear, and impossible for a bad one to fake sustainably.
      </P>

      <StatGrid
        stats={[
          { label: "BACKTEST CAGR", value: "+38.99%", green: true },
          { label: "S&P 500 SAME PERIOD", value: "+83.34%" },
          { label: "ALPHA (3.8Y)", value: "+167%", green: true },
          { label: "SHARPE", value: "1.14" },
        ]}
      />

      <H2>Scaling the math across portfolio sizes</H2>
      <P>
        Here is the same $1,000 fee applied to different account sizes. Notice
        how the required alpha explodes as the portfolio shrinks — this is the
        reason stock picking services are not democratic products. They are
        tools for investors who already have meaningful capital.
      </P>

      <CompareTable
        headers={["Portfolio size", "$1k fee as %", "Break-even alpha", "Verdict"]}
        rows={[
          ["$5,000", "20.0%", "+20.0%", "Dilutive — do not subscribe"],
          ["$10,000", "10.0%", "+10.0%", "Unrealistic hurdle"],
          ["$25,000", "4.0%", "+4.0%", "High hurdle — marginal"],
          ["$50,000", "2.0%", "+2.0%", "Plausible — borderline"],
          ["$100,000", "1.0%", "+1.0%", "Low hurdle — worth considering"],
          ["$250,000", "0.4%", "+0.4%", "Very low hurdle"],
          ["$500,000", "0.2%", "+0.2%", "Trivially worth it if alpha is real"],
        ]}
      />

      <H2>When it is not worth it</H2>
      <P>
        There are specific situations where the honest answer is &quot;skip
        the service and buy an index fund.&quot; We publish this list because
        we would rather be trusted than oversubscribed.
      </P>

      <UL>
        <LI>
          <Strong>Portfolio under $25k.</Strong> The fee math does not work.
          Build the base first.
        </LI>
        <LI>
          <Strong>Short time horizon.</Strong> If you need the money in under
          two years, you should not be picking stocks at all — you should be
          in cash or short-duration bonds.
        </LI>
        <LI>
          <Strong>You will not actually follow the picks.</Strong> If you pay
          for a service and then second-guess every recommendation, you are
          paying for ideas you refuse to use. The optionality has negative
          value.
        </LI>
        <LI>
          <Strong>You are still paying off high-interest debt.</Strong> Any
          guaranteed return above 7% — such as paying down a credit card —
          beats any risky strategy on a risk-adjusted basis.
        </LI>
        <LI>
          <Strong>You already have a process that works.</Strong> If you are
          consistently beating the market on your own, adding a newsletter is
          noise.
        </LI>
      </UL>

      <Callout variant="warning" title="Honest disclaimer">
        <P>
          Outpick is educational research, not financial advice. Past
          performance is not indicative of future results. If any of the five
          situations above describe you, please do not subscribe to us or to
          anyone else.
        </P>
      </Callout>

      <H2>What you are actually buying (a research analyst)</H2>
      <P>
        Reframe the purchase. When you subscribe to a serious stock picking
        service, you are not buying tips — you are renting a research analyst.
        Consider the alternative cost of that person on a payroll.
      </P>

      <P>
        A mid-level equity research analyst in New York costs a firm $150k to
        $300k a year in fully loaded compensation. A junior analyst with
        Bloomberg access, a CFA, and a disciplined process is not available
        for less than roughly $120k. Even the cheapest portfolio manager a
        traditional wealth advisor can assign you comes bundled with a 1%
        AUM fee — on a $500k account, that is $5,000 a year, every year,
        whether the picks work or not.
      </P>

      <P>
        A $1,000-a-year subscription that covers the same research process is
        a fraction of a percent of that cost. The reason it can be priced so
        low is leverage: the same research memo serves thousands of
        subscribers simultaneously, which is exactly what the internet made
        possible and exactly what the incumbents have not priced for.
      </P>

      <InlineCTA />

      <H2>How to evaluate the alpha claim</H2>
      <P>
        Before you trust any alpha figure, ask four questions. This is the
        same filter we would apply to our own numbers.
      </P>
      <OL>
        <li>
          <Strong>Over what period?</Strong> A one-year number is noise. A
          three-to-five-year walk-forward number is a signal.
        </li>
        <li>
          <Strong>Against which benchmark?</Strong> The S&amp;P 500 total
          return is the honest comparison. A price-only index or a bond blend
          is not.
        </li>
        <li>
          <Strong>On what kind of capital?</Strong> Realistic position sizes
          with realistic slippage, not an idealized equal-weight portfolio
          that never touches the bid-ask spread.
        </li>
        <li>
          <Strong>At what risk?</Strong> Read the{" "}
          <A href="/blog/sharpe-ratio-explained-for-individual-investors">
            Sharpe ratio
          </A>{" "}
          and the maximum drawdown. Raw return without risk context is
          meaningless. A strategy that returned 40% with a 60% drawdown is
          worse than one that returned 20% with a 10% drawdown.
        </li>
      </OL>

      <P>
        For more on the specific thing a picking service should be delivering,
        read our explainer on{" "}
        <A href="/blog/alpha-vs-beta-what-active-stock-picking-actually-buys-you">
          alpha versus beta
        </A>
        . It clarifies what you are actually paying for when you pay for
        active picks.
      </P>

      <H2>Our numbers, your decision</H2>
      <P>
        Here is what Outpick has done, stated plainly. Over a 3.8-year
        walk-forward backtest from June 2022 through April 2026, the strategy
        returned +250.39% versus +83.34% for the S&amp;P 500 — roughly 167
        percentage points of alpha. The Sharpe ratio was 1.14, the max
        drawdown was -27.38% in April 2025, and the win rate across 132
        trades was 66%. The out-of-sample portion alone (July 2024 through
        April 2026) added 67% of alpha on data the strategy had never seen
        when it was built.
      </P>
      <P>
        On a $100k portfolio, the break-even alpha for our $1,000 annual fee
        is roughly 1%. The backtest exceeded that hurdle by a factor of about
        twenty. Live trading began April 1, 2026 — real money, real trades,
        published{" "}
        <A href="/dashboard">in the dashboard</A> as they happen. The historical
        numbers are the basis for the decision, but the going-forward numbers
        are the ones that matter, and we publish those openly.
      </P>

      <P>
        Is paying for a stock picking service worth it? At the right portfolio
        size, against a legitimate walk-forward track record, with a fee that
        is a small fraction of the alpha generated — yes. At the wrong
        portfolio size, against cherry-picked marketing numbers, with a fee
        that eats a meaningful chunk of the portfolio — absolutely not. The
        math makes the decision, not the sales page.
      </P>

      <FAQList
        items={[
          {
            q: "How big should my portfolio be before paying for stock picks?",
            a: "As a rule of thumb, a $1,000-a-year service starts to make mathematical sense at around $50k and becomes clearly worthwhile above $100k. Below $25k the fee represents too large a share of the portfolio, and the break-even alpha becomes unrealistic for any honest strategy to clear.",
          },
          {
            q: "How do I calculate alpha vs the S&P 500?",
            a: (
              <>
                Alpha is your total return minus the return of the S&amp;P 500
                total return index over the same period, holding risk constant.
                The simple version: if your portfolio returned 15% and the
                S&amp;P 500 returned 10%, your raw alpha is +5%. See{" "}
                <A href="/blog/alpha-vs-beta-what-active-stock-picking-actually-buys-you">
                  our alpha vs beta article
                </A>{" "}
                for the risk-adjusted version.
              </>
            ),
          },
          {
            q: "Are stock picking services tax-deductible?",
            a: "For most individual investors, no. The Tax Cuts and Jobs Act eliminated the miscellaneous itemized deduction for investment expenses at the federal level in the US. Some taxpayers may still deduct these expenses at the state level or if they qualify as traders for tax purposes, but the general answer for retail investors is that subscription fees come out of after-tax income. Consult a tax professional for your specific situation.",
          },
          {
            q: "Why do most stock pickers underperform?",
            a: "Three reasons: fees compound against them, they trade too often and lose to transaction costs and taxes, and they lack a disciplined process for separating signal from noise. Most underperformance is not a lack of insight — it is a lack of structure. A good service provides that structure.",
          },
          {
            q: "What if the service has a bad year?",
            a: "Every strategy has drawdowns. Ours was -27.38% in April 2025. The right response to a bad year is not to cancel but to compare the drawdown to the strategy's historical maximum drawdown and ask whether the thesis is still intact. If the process is the same and the losses are within the expected distribution, that is a normal bad year, not a broken strategy.",
          },
        ]}
      />

      <KeyTakeaway>
        <P>
          Paying for a stock picking service is worth it when the dollar alpha
          exceeds the fee plus your time cost. Do the break-even math first,
          demand a real walk-forward track record second, and make the
          decision on arithmetic — not on the promise of the next big winner.
        </P>
      </KeyTakeaway>
    </Prose>
  ),
};

export default article;
