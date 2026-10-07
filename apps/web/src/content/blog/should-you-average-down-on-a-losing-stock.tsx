import type { Article } from "@/lib/blog";
import {
  Prose,
  Lede,
  H2,
  H3,
  P,
  UL,
  OL,
  LI,
  Strong,
  A,
  KeyTakeaway,
  InlineCTA,
  FAQList,
  TLDR,
  CompareTable,
} from "@/components/blog/prose";

const article: Article = {
  meta: {
    slug: "should-you-average-down-on-a-losing-stock",
    title: "Should You Average Down on a Losing Stock? A 5-Question Test",
    description:
      "Should you average down on a losing stock? A 5-question test on thesis, position size, and opportunity cost before you buy more of a falling stock.",
    keyword: "should you average down on a losing stock",
    keywords: [
      "should you average down on a losing stock",
      "averaging down stocks",
      "averaging down vs dollar cost averaging",
      "buy more of a stock that dropped",
      "when to average down",
      "sunk cost fallacy investing",
    ],
    publishedAt: "2026-10-07",
    category: "Strategy",
    tags: [
      "position sizing",
      "risk management",
      "averaging down",
      "stock research",
    ],
    readingTime: 9,
    author: "Outpick Research",
    cover: "/art/covers/should-you-average-down-on-a-losing-stock.png",
  },
  Content: () => (
    <Prose>
      <Lede>
        Average down only when the reason you bought the stock still holds,
        you would buy it today with fresh cash at this price, and the larger
        position still fits your size limit. A lower price on its own is not
        a reason to add. If the business has changed, or if adding would make
        one stock a much bigger part of your portfolio than you planned, a
        cheaper share price only makes the mistake bigger.
      </Lede>

      <TLDR>
        <P>
          Average down only when the reason you bought the stock still holds,
          you would buy it today with fresh cash at this price, and the
          larger position still fits your size limit. A lower price on its
          own is not a reason to add. If the business has changed, or if
          adding would make one stock a much bigger part of your portfolio
          than you planned, a cheaper share price only makes the mistake
          bigger.
        </P>
      </TLDR>

      <P>
        That&apos;s the whole answer. The rest of this guide shows how to
        apply it when you&apos;re staring at a red position and both choices
        look reasonable.
      </P>

      <H2>Why this question is so hard on Reddit</H2>
      <P>
        The threads that rank for this question share a pattern. Someone buys
        a stock with conviction, often a quality name. It drops after
        earnings or in a sell-off. Now they&apos;re stuck between two fears:
        selling right before a rebound, or adding money to a business that
        keeps sinking. Often they already sold a different loser that rallied
        soon after, and that memory makes them want to hold this one.
      </P>
      <P>The best replies keep making the same points:</P>
      <UL>
        <LI>
          <Strong>Averaging down is not dollar-cost averaging.</Strong> DCA
          means buying on a fixed schedule whatever the price does. Averaging
          down is a choice to buy <Strong>because</Strong> the price fell.
          Rebalancing back to a target weight is a third thing. People mix
          the three up, and that&apos;s where much of the confusion comes
          from.
        </LI>
        <LI>
          <Strong>
            &ldquo;Would you buy it today if you didn&apos;t own it?&rdquo;
          </Strong>{" "}
          That is the single most useful filter, and it shows up in almost
          every good answer.
        </LI>
        <LI>
          <Strong>
            Index funds and single stocks are not the same case.
          </Strong>{" "}
          Buying more of a broad index fund after a drop rests on the
          market&apos;s long history of recovering. A single company can go
          to zero, and that difference matters a lot here.
        </LI>
      </UL>
      <P>
        Where the threads, and most of the articles ranking next to them,
        fall short is the step <Strong>after</Strong> that filter: how to
        check it honestly, how big the position can get, and what to do if
        the stock keeps falling after you add. That&apos;s what this guide
        covers.
      </P>

      <H2>The math that makes averaging down feel better than it is</H2>
      <P>
        Averaging down lowers your breakeven price, and that feels like
        progress. Here&apos;s a worked example, using made-up round numbers
        to show how it works:
      </P>
      <CompareTable
        headers={[
          "Step",
          "Shares",
          "Price",
          "Cash in",
          "Position value",
          "Average cost",
        ]}
        rows={[
          ["Initial buy", "100", "$60", "$6,000", "$6,000", "$60.00"],
          ["Stock falls 40%", "100", "$36", "—", "$3,600", "$60.00"],
          ["Add $3,000", "+83.3", "$36", "$3,000", "$6,600", "$49.09"],
        ]}
      />
      <P>
        Before adding, the stock had to rise <Strong>66.7%</Strong> to get
        you back to even. After adding, it only has to rise{" "}
        <Strong>36.4%</Strong>. That smaller hurdle is what makes averaging
        down so tempting.
      </P>
      <P>But look at what actually changed:</P>
      <UL>
        <LI>
          <Strong>
            The stock doesn&apos;t care about your cost basis.
          </Strong>{" "}
          The $3,000 you added earns exactly what the stock does from $36.
          If you&apos;d bought it fresh with no history, you&apos;d get the
          same result.
        </LI>
        <LI>
          <Strong>Your exposure went up.</Strong> Say this sits in a
          $100,000 portfolio and everything else is flat. The position was
          about 3.7% of the portfolio after the drop. After adding,
          it&apos;s about 6.8%, larger than when you started, in the one
          name that has just proved you wrong.
        </LI>
        <LI>
          <Strong>The downside got bigger.</Strong> If the stock halves
          again to $18, the position without the add loses $1,800 more. With
          the add, it loses $3,300 more. That&apos;s about 1.8 versus 3.4
          percentage points of the whole portfolio. You can run your own
          numbers in the{" "}
          <A href="/tools/downside-risk-worksheet">
            downside risk worksheet
          </A>
          .
        </LI>
      </UL>
      <P>
        Losses also take more to recover than they seem to. Pure arithmetic:
        a 20% loss needs a 25% gain to get back to even, a 40% loss needs
        about 67%, and a 50% loss needs 100%. Averaging down makes the
        hurdle smaller, but it does nothing to make the climb more likely.
      </P>
      <P>
        And the climb is not guaranteed. Research by Hendrik Bessembinder at
        Arizona State found that most individual stocks (55.2% of U.S.
        stocks in a 1991–2020 global sample) underperformed one-month U.S.
        Treasury bills over the full period, and that a small minority of
        firms accounted for all net stock market wealth creation (
        <A href="https://wpcarey.asu.edu/department-finance/faculty-research/do-stocks-outperform-treasury-bills">
          ASU W. P. Carey summary
        </A>
        ). For a single stock, &ldquo;it&apos;ll come back eventually&rdquo;
        is a hope, not a law of markets.
      </P>

      <H2>The 5-question test before you average down</H2>
      <P>
        Answer these in writing before you place the order. If you can&apos;t
        answer one clearly, that&apos;s your answer for now.
      </P>

      <H3>1. Why did it fall: market, sector, noise, or thesis?</H3>
      <P>Put the drop in one of four buckets:</P>
      <OL>
        <LI>
          <Strong>Market-wide:</Strong> everything sold off and your
          company&apos;s story didn&apos;t change.
        </LI>
        <LI>
          <Strong>Sector-wide:</Strong> peers fell together on a macro or
          industry-level worry.
        </LI>
        <LI>
          <Strong>Company noise:</Strong> a quarter missed on timing, a
          one-off cost, a guidance cut you can explain.
        </LI>
        <LI>
          <Strong>Thesis-relevant:</Strong> the thing your thesis depended
          on got worse. Margins, growth, competitive position, balance
          sheet, or management credibility.
        </LI>
      </OL>
      <P>
        Buckets 1–3 <Strong>can</Strong> justify adding. Bucket 4 is a
        reason to re-underwrite or exit, not to buy more. If you never wrote
        down what your thesis depended on, start there. The{" "}
        <A href="/blog/investment-thesis-template">
          investment thesis template
        </A>{" "}
        gives you a structure for it.
      </P>

      <H3>2. Would you buy it today, at this price, with fresh cash?</H3>
      <P>
        Picture a friend handing you cash with no position and no history.
        Would you buy this company at this valuation? Re-check the numbers
        that matter now, not the ones you used originally. Use the{" "}
        <A href="/tools/intrinsic-value-calculator">
          intrinsic value calculator
        </A>{" "}
        and the{" "}
        <A href="/tools/free-cash-flow-worksheet">
          free cash flow worksheet
        </A>
        . If your estimate of value fell as far as the price did, the stock
        isn&apos;t any cheaper. It&apos;s just smaller.
      </P>

      <H3>
        3. What will the position weigh after you add, and is that under
        your cap?
      </H3>
      <P>
        Set a maximum position size <Strong>before</Strong> you need it.
        Many self-directed investors cap any single stock somewhere around
        5–10% of the total portfolio. Your number depends on how many names
        you hold and how much risk you can stomach. Work out the post-add
        weight. If adding would push you past the cap, the answer is no, or
        a smaller add. The{" "}
        <A href="/tools/concentrated-portfolio-calculator">
          concentrated portfolio calculator
        </A>{" "}
        shows what a large single position does to portfolio-level swings.
      </P>

      <H3>4. Is this the best use of the cash?</H3>
      <P>
        The alternative to averaging down isn&apos;t &ldquo;do
        nothing.&rdquo; It&apos;s every other place the money could go: your
        next-best idea, a broad index fund, or cash you need anyway. If the
        stock wouldn&apos;t make your top few ideas as a new position,
        adding to it is mostly about feeling better, not making a good
        investment.
      </P>

      <H3>5. What will you do if it falls another 30%?</H3>
      <P>
        Write it down now: &ldquo;If it drops to $X <Strong>and</Strong>{" "}
        [specific metric] deteriorates, I sell. If it drops on no new
        information, I hold and do not add again.&rdquo; Plan your adds in
        advance and cap how many times you&apos;ll add. One planned add is a
        strategy. Adding again every time the price drops is how a 3%
        position becomes a 15% problem.
      </P>
      <P>
        <Strong>Scoring:</Strong> Add only if the answer to 1 is buckets
        1–3, the answers to 2 and 4 are yes, the answer to 3 stays under
        your cap, and you have a written answer to 5. Anything less means
        hold or trim, and stay out of the &ldquo;buy more&rdquo; decision.
      </P>

      <H2>Edge cases the threads keep raising</H2>
      <P>
        <Strong>
          &ldquo;I sold a loser last time and it ran 20% right after.&rdquo;
        </Strong>{" "}
        Every rule that cuts losses will sometimes cut a stock that
        recovers. That&apos;s the price of having a rule. One painful memory
        is not evidence about <Strong>this</Strong> stock, and it
        shouldn&apos;t make you hold the next loser too long.
      </P>
      <P>
        <Strong>&ldquo;It&apos;s an index fund, not a stock.&rdquo;</Strong>{" "}
        That&apos;s a different case. A broad index can&apos;t lose its
        diversification the way one company can lose its business. Regular
        buying into a diversified fund after a drop is closer to DCA or
        rebalancing than to averaging down on a single stock.
      </P>
      <P>
        <Strong>
          &ldquo;It&apos;s down 50%. Isn&apos;t that a bargain?&rdquo;
        </Strong>{" "}
        Only if the value didn&apos;t fall too. A 50% drop on bad news can
        still leave a business that is fully priced. A drop that big calls
        for a full re-underwrite, not a reflexive buy.
      </P>
      <P>
        <Strong>&ldquo;I&apos;m using margin.&rdquo;</Strong> Don&apos;t
        average down on leverage. A falling price plus a bigger position can
        force a sale at the worst moment, before any recovery has a chance
        to happen.
      </P>
      <P>
        <Strong>&ldquo;What about taxes?&rdquo;</Strong> In a U.S. taxable
        account, there&apos;s a timing wrinkle if you&apos;re considering
        selling at a loss for tax purposes. Under wash sale rules, buying
        substantially identical securities within 30 days before or after a
        loss sale disallows deducting that loss (
        <A href="https://www.investor.gov/introduction-investing/investing-basics/glossary/wash-sales">
          Investor.gov
        </A>
        ). Adding shortly before or after a tax-loss sale can undo it. Check
        with a tax professional for your situation.
      </P>
      <P>
        <Strong>&ldquo;It&apos;s my employer&apos;s stock.&rdquo;</Strong> Be
        extra skeptical. Your income and your portfolio already depend on
        the same company, so adding more on a drop deepens a risk you
        already carry.
      </P>

      <H2>A simple pre-commitment template</H2>
      <P>
        Copy this into your notes for every position at the time you buy:
      </P>
      <UL>
        <LI>
          <Strong>Thesis in one sentence:</Strong>
        </LI>
        <LI>
          <Strong>What has to stay true (2–3 measurable items):</Strong>
        </LI>
        <LI>
          <Strong>Starting size / maximum size:</Strong>
        </LI>
        <LI>
          <Strong>Planned adds:</Strong> price or condition, and amount (max
          1–2)
        </LI>
        <LI>
          <Strong>Exit triggers:</Strong> which metric, at what level, does
          the thesis break?
        </LI>
        <LI>
          <Strong>Review date:</Strong>
        </LI>
      </UL>
      <P>
        When the stock drops, you&apos;re no longer deciding from scratch
        under stress. You&apos;re checking against a plan you wrote when you
        were calm. For the other side of the decision, see{" "}
        <A href="/blog/when-to-sell-a-stock-thesis-broken">
          when to sell a stock when the thesis is broken
        </A>
        . It&apos;s the same thinking, pointed at the exit.
      </P>

      <H2>How Outpick approaches this</H2>
      <P>
        Every Outpick pick ships with a full written thesis, so members can
        see what each position depends on and judge later developments
        against it. Our live example portfolio also keeps losing positions
        visible instead of quietly dropping them. That makes &ldquo;has the
        thesis changed, or just the price?&rdquo; something you can actually
        check, not just a feeling. If you want that kind of written
        reasoning every two weeks, the flat annual membership is on the{" "}
        <A href="/pricing">pricing page</A>.
      </P>

      <InlineCTA href="/pricing" />

      <FAQList
        items={[
          {
            q: "Is averaging down a good strategy?",
            a: "Sometimes, in a narrow case: the thesis is intact, the drop is from market, sector, or one-off noise, you would buy fresh at this price, and the bigger position stays within your size limit. As a reflex every time a stock drops, it isn't. It tends to make your largest position the one that's going worst.",
          },
          {
            q: "What's the difference between averaging down and dollar-cost averaging?",
            a: (
              <>
                Dollar-cost averaging means investing fixed amounts on a
                schedule regardless of price. Averaging down is a choice to
                buy more <Strong>because</Strong> a holding fell. DCA takes
                the decision out. Averaging down puts one in, so it needs a
                reason beyond the lower price.
              </>
            ),
          },
          {
            q: "How much should I add when I average down?",
            a: "Size the add so the post-add position stays under the single-stock cap you set in advance. Many investors split any planned adds into one or two tranches decided at purchase time, not improvised after the drop.",
          },
          {
            q: "Should I average down to get back to breakeven faster?",
            a: "Breakeven is a psychological anchor, not a goal. New money earns the stock's return from today's price. If getting back to even is the main reason, compare it honestly with your next-best idea or a broad index fund.",
          },
          {
            q: "Is this financial advice?",
            a: "No. This article is for education only and isn't personalized financial advice. Your situation, taxes, and risk tolerance are your own. Consider speaking with a licensed professional before making investment decisions. Past performance does not guarantee future results.",
          },
        ]}
      />

      <KeyTakeaway>
        <P>
          Your average cost doesn&apos;t affect what the stock does next.
          The new money earns the stock&apos;s return from today&apos;s
          price, the same as if you had never owned it. So the honest
          question isn&apos;t &ldquo;how do I get back to
          breakeven?&rdquo; It&apos;s &ldquo;is this the best place for
          this cash right now?&rdquo;
        </P>
      </KeyTakeaway>

      <P>
        Outpick is an independent educational publication, not a registered
        investment adviser. Nothing here is a recommendation to buy or sell
        any security.
      </P>
    </Prose>
  ),
};

export default article;
