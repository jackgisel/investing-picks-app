import {
  A,
  CompareTable,
  H2,
  H3,
  LI,
  OL,
  P,
  Prose,
  Strong,
  UL,
} from "@/components/blog/prose";

export function AverageDownCalculatorArticle() {
  return (
    <Prose>
      <H2>How averaging down works</H2>
      <P>
        Averaging down means buying more of a stock you already own after the
        price has fallen, so the blended cost of the whole position drops. This
        page is an average down calculator and a stock average calculator: it
        does that blend on numbers you type and shows the new average cost, how
        many shares (or dollars) the add is, and what happens to position
        weight if you fill in a portfolio value.
      </P>
      <P>
        The formula is:
      </P>
      <P>
        <Strong>New average cost</Strong> = (existing shares × existing average
        + new shares × current price) / (existing shares + new shares)
      </P>
      <P>
        That is the same math whether you type one average or a list of prior
        buys. A list of buys is only a way to rebuild the current share count
        and average cost. Total invested is cash in at cost, not the market
        value of the position. Unrealized P/L now is (current price minus average
        cost) times current shares, on the stock you already hold.
      </P>
      <P>
        The reverse question,{" "}
        <Strong>how much to buy to average down</Strong> to a target, rearranges
        the same formula. Shares to buy = current shares × (current average −
        target) / (target − current price). The target has to sit{" "}
        <Strong>between</Strong> the current price and the current average. If
        the target is at or below the price you are paying, no quantity of
        shares will get you there: the new average cannot fall through the
        purchase price.
      </P>

      <H2>A worked example (hypothetical)</H2>
      <P>
        The figures below are round numbers for illustration, not a stock, a
        forecast, or a recommendation.
      </P>
      <CompareTable
        headers={["Step", "Shares", "Price", "Cash in", "Average cost"]}
        rows={[
          ["Initial buy", "100", "$60", "$6,000", "$60.00"],
          ["Stock falls 40%", "100", "$36", "—", "$60.00"],
          ["Add $3,000", "+83.33", "$36", "$3,000", "$49.09"],
        ]}
      />
      <P>
        Before the add, the stock had to rise{" "}
        <Strong>66.7%</Strong> from $36 to get back to a $60 average. After the
        add you hold 183.33 shares with $9,000 in at cost, so the stock has to
        rise <Strong>36.4%</Strong> from $36 to get back to $49.09. Unrealized
        loss on the original lot is still $2,400 at that instant. The new cash
        is spent at $36, so it is not in the hole yet.
      </P>
      <P>
        Type a portfolio value and the weight panel is the part generic
        average cost calculator stocks pages usually skip. On a hypothetical
        $100,000 book, the position is 3.6% at $36. After adding $3,000 of new
        cash it is about 6.4% of $103,000. If the stock then falls another 50%,
        the book is hit about 1.8 points before the add and about 3.2 points
        after. Same arithmetic as the{" "}
        <A href="/tools/downside-risk-worksheet">downside risk worksheet</A>,
        with the add included.
      </P>

      <H2>A lower average does not change what the stock does next</H2>
      <P>
        Your average cost is bookkeeping. The shares you already own will make
        or lose the same money from today&apos;s price whether or not you add.
        The new money earns whatever the stock does from here, the same as if
        you had never owned it. A smaller percent move back to breakeven feels
        like progress. It is not evidence that a rebound is more likely.
      </P>
      <P>
        Losses also take a larger gain to recover than they appear to. Pure
        arithmetic: a 20% drop needs a 25% rise to get back to even, a 40% drop
        needs about 67%, and a 50% drop needs 100%. Averaging down shrinks the
        percent hurdle on the blended book. It does nothing to make the climb
        happen. For the longer case on thesis, sunk cost, and when not to add,
        read{" "}
        <A href="/blog/should-you-average-down-on-a-losing-stock">
          should you average down on a losing stock
        </A>
        .
      </P>

      <H2>Five questions before you add</H2>
      <P>
        Run the numbers first, then answer these in writing. If you cannot
        answer one clearly, that is the answer for now.
      </P>
      <OL>
        <LI>
          <Strong>Why did it fall?</Strong> Market, sector, one-off noise, or
          the thing your thesis depended on? The first three can still be a buy
          if the business is the one you wanted. A broken thesis is a reason to
          re-underwrite or exit, not to make the position larger. Re-check value
          with the{" "}
          <A href="/tools/intrinsic-value-calculator">
            intrinsic value calculator
          </A>{" "}
          if the cash-flow case changed.
        </LI>
        <LI>
          <Strong>Would I buy it fresh today?</Strong> Picture a friend handing
          you cash with no lot and no history. If you would not start the
          position at this price, adding is mostly about feeling better, not
          about a new investment.
        </LI>
        <LI>
          <Strong>What will the position weigh after the add, versus my cap?</Strong>{" "}
          Set a maximum single-stock weight before you need it. Type your
          portfolio value above and read weight after the add. If it would push
          you past the cap, the answer is no, or a smaller add. The{" "}
          <A href="/tools/concentrated-portfolio-calculator">
            concentrated portfolio calculator
          </A>{" "}
          shows how a large name moves the whole book. For how much of a
          portfolio to put in individual stocks at all, see{" "}
          <A href="/blog/what-percentage-of-portfolio-should-be-individual-stocks">
            what percentage of a portfolio should be individual stocks
          </A>
          .
        </LI>
        <LI>
          <Strong>Is this the best use of this cash?</Strong> The alternative is
          not &ldquo;do nothing.&rdquo; It is every other place the money could
          go: the next idea, a broad fund, or cash you actually need. If the
          stock would not make the list as a new position, averaging down is a
          story about the old one.
        </LI>
        <LI>
          <Strong>What do I do if it falls another 30%?</Strong> Write it down
          now: a price and a metric that would make you sell, and a rule that
          you will not add again on the same thesis. The weight panel&apos;s 30%
          and 50% hits are there so that sentence has a number. One planned add
          is a plan. Adding every time the quote prints lower is how a small
          line becomes the whole risk.
        </LI>
      </OL>

      <H2>Dollar-cost averaging is not averaging down</H2>
      <P>
        Dollar-cost averaging (DCA) means investing a fixed amount on a
        schedule, whatever the price does. Averaging down is a choice to buy{" "}
        <Strong>because</Strong> a holding already fell. Rebalancing back to a
        target weight is a third thing. People mix the three up, and the mix is
        how a one-off add turns into an unplanned concentration.
      </P>
      <P>
        This calculator measures one add. It does not run a calendar of future
        buys, and it does not assume the stock mean-reverts. If you are
        contributing on a schedule to a diversified fund, you are closer to DCA
        than to averaging down on a single name. A single company can go to
        zero. That difference is the whole point of the five questions.
      </P>

      <H2>Wash sales</H2>
      <P>
        In a U.S. taxable account there is a timing wrinkle if you are also
        thinking about selling at a loss. Under wash sale rules, buying a
        substantially identical security within 30 days before or after a loss
        sale can disallow deducting that loss. Adding shortly before or after a
        tax-loss sale can undo it. Read the{" "}
        <A href="https://www.investor.gov/introduction-investing/investing-basics/glossary/wash-sales">
          Investor.gov glossary on wash sales
        </A>
        . This tool does not compute tax lots. Check with a tax professional
        for your situation.
      </P>
      <P>
        None of this is a recommendation to buy or sell any security. The
        starting figures on the calculator are hypothetical. If you want the
        written research behind Outpick names, that lives on the membership
        side of the site, not in this arithmetic.
      </P>
    </Prose>
  );
}
