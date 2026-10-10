import type { Article } from "@/lib/blog";
import {
  Prose,
  Lede,
  H2,
  P,
  Strong,
  A,
  KeyTakeaway,
  InlineCTA,
  FAQList,
  TLDR,
} from "@/components/blog/prose";

const article: Article = {
  meta: {
    slug: "building-concentrated-stock-portfolios",
    title: "Building Concentrated Stock Portfolios Well",
    description:
      "Building concentrated stock portfolios requires more than conviction. Learn how to size positions, test theses, and manage risk with discipline over time.",
    keyword: "building concentrated stock portfolios",
    keywords: [
      "building concentrated stock portfolios",
      "concentrated stock portfolio",
      "position sizing",
      "investment thesis",
      "portfolio concentration",
      "stock research",
    ],
    publishedAt: "2026-10-10",
    category: "Education",
    subcategory: "portfolio-construction",
    tags: [
      "concentrated portfolio",
      "position sizing",
      "investment thesis",
      "risk management",
    ],
    readingTime: 8,
    author: "Outpick Research",
    cover: "/art/covers/building-concentrated-stock-portfolios.png",
  },
  Content: () => (
    <Prose>
      <Lede>
        Conviction is easy to feel and hard to underwrite. A short list of
        favorite companies is not a portfolio.{" "}
        <Strong>Building concentrated stock portfolios</Strong> well means
        sizing each position for uncertainty, testing the thesis before the
        weight grows, and managing the risks that appear only when several
        holdings are read together.
      </Lede>

      <TLDR>
        <P>
          Building concentrated stock portfolios requires more than
          conviction. Choose a number of names you can actually follow,
          size each holding for a credible adverse case rather than for how
          strongly you feel, and write the thesis and the exit conditions
          before you buy. Watch overlap across businesses, not only ticker
          count. Review on a schedule, and change a weight when the facts
          change. Concentration is a process that has to be held over time.
        </P>
      </TLDR>

      <P>
        Concentration is the decision to let a small number of businesses
        dominate results. That can be a sound choice for an investor who
        does original work and can live with lumpy outcomes. It can also
        be a way to concentrate ignorance. The difference is not
        temperament. It is whether each position was sized, tested, and
        given rules that still make sense after the price has moved.
      </P>

      <H2>Concentration Is a Construction Problem</H2>
      <P>
        A concentrated book is not simply a diversified book with names
        deleted. Removing tickers without rewriting weights, overlap, and
        review rules leaves the same ideas in a more fragile wrapper. The
        useful questions are practical. How many businesses can you follow
        with a written case? How large can one holding become before a
        plausible decline does damage you cannot reverse? Which holdings
        would fail for the same reason?
      </P>
      <P>
        Those questions belong on the page before capital is committed.
        After a stock has already doubled, or already halved, the answers
        tend to arrive as justifications. Construction is the unglamorous
        work of deciding the role of each position while you are still
        calm enough to be honest about it.
      </P>
      <P>
        It also helps to say what concentration is not. It is not a
        personality. It is not a requirement to be fully invested. It is
        not a license to skip the balance sheet because the story is
        compelling. The investor still has to live with drawdowns,
        tax lots, and the ordinary fact that even a good business can be
        a poor purchase at the wrong price.
      </P>

      <H2>How Many Stocks Is the First Constraint, Not the Whole Job</H2>
      <P>
        Name count sets a ceiling on how closely you can follow each
        company. Too few names and a single error defines the year. Too
        many and the book starts to behave like the index you were trying
        to leave, with extra work attached. The practical band for an
        active stock book is usually in the teens to the mid-twenties,
        for reasons laid out in{" "}
        <A href="/blog/how-many-stocks-should-you-hold-to-beat-the-market">
          how many stocks you should hold to beat the market
        </A>
        .
      </P>
      <P>
        Count is still only a constraint. Twenty names that all depend on
        the same customer budget, the same commodity, or the same
        refinancing window are not twenty independent bets. Five names
        with genuinely different economic drivers can be more diversified
        than a longer list that rhymes. The construction job is to make
        the count mean something.
      </P>
      <P>
        There is also a time budget. A concentrated investor who cannot
        read a 10-K, follow a competitive shift, and update a written
        case on a schedule is not concentrated. They are busy. If the
        list is longer than the hours available to maintain it, the
        honest move is to hold fewer companies or to keep a larger share
        of the household in a broad fund.
      </P>

      <H2>Size Positions for Uncertainty, Not for How Sure You Feel</H2>
      <P>
        Conviction is a poor sizing tool. It is highest at the moment of
        purchase, often when the evidence is thinnest, and it tends to
        rise with the stock. A better input is the adverse case: what a
        serious operational miss, a lower multiple, or a balance-sheet
        strain would do to the position and to the whole book.
      </P>
      <P>
        Start with arithmetic. A 10% position that falls 50% costs the
        portfolio five points. A 25% position that does the same costs
        twelve and a half. Those are not forecasts. They are the terms
        on which you are volunteering to be wrong. The{" "}
        <A href="/tools/concentrated-portfolio-calculator">
          concentrated portfolio calculator
        </A>{" "}
        is a way to see equal-weight and top-heavy math before a ticker
        is attached to it.
      </P>
      <P>
        Size should also reflect the quality of the underwriting. A
        business with recurring demand, a clean balance sheet, and a
        modest valuation can carry more weight than one that needs a
        refinancing, a product cycle, or an optimistic multiple to work.
        Liquidity matters too. A position that cannot be reduced without
        moving the price is larger than the percentage on the statement
        suggests.
      </P>
      <P>
        Winners create a second sizing problem. Letting a holding run is
        often the source of the return that made concentration worth the
        trouble. Letting it become the book is a different decision. Set
        a review threshold in advance, such as a weight at which the
        original case must be rewritten, rather than waiting until the
        position feels too large in hindsight. Trimming is a
        construction choice. It is not a comment on whether the company
        is still a good business.
      </P>

      <H2>Test the Thesis Before the Weight Gets Large</H2>
      <P>
        A concentrated position is a claim about a business, a price, and
        a set of conditions that would prove the claim wrong. If that
        claim is only in your head, the market will write the first
        revision. Use a written{" "}
        <A href="/blog/investment-thesis-template">
          investment thesis template
        </A>{" "}
        so the case can be checked later against facts rather than
        against mood.
      </P>
      <P>
        The test is not whether the company is admirable. It is whether
        the current price leaves room to be right about the business and
        wrong about several details. Earnings power, capital needs,
        competitive position, and management incentives all belong in
        that write-up. So does the mechanism: what has to happen in the
        next few years for the investment to make sense, in language
        specific enough that a later reader could tell if it happened.
      </P>
      <P>
        Starter sizes exist for this reason. A 1% or 2% position can be
        a way to stay honest while evidence accumulates. Adding is then a
        second underwriting, not a reward for being emotionally attached.
        If the only reason to add is that the stock is down, the original
        case was not doing the work. Price is information. It is not
        automatically a better entry.
      </P>
      <P>
        Revisit the thesis on a calendar, not on a tick. Quarterly
        filings, a competitor&apos;s result, a change in capital
        allocation, or a shift in customer behavior are better review
        triggers than a headline. Concentration fails most often when
        the investor updates the story faster than the facts.
      </P>

      <H2>Manage the Risks That Ticker Count Does Not Show</H2>
      <P>
        The hidden risk in a concentrated book is overlap. Two software
        companies can share the same enterprise-budget cycle. A bank and
        a homebuilder can share the same credit conditions. A miner and
        a manufacturer can share the same commodity. When those links
        tighten, diversification that looked adequate on a holdings list
        disappears at the same time.
      </P>
      <P>
        Write the shared dependencies down. Customer, input cost,
        geography, funding market, and valuation regime are a useful
        start. Then ask what would have to go wrong for several holdings
        to hurt at once. If the honest answer is &quot;the same
        recession, the same rate move, or the same loss of confidence in
        long-duration growth,&quot; the book is more concentrated than
        the ticker count implies.
      </P>
      <P>
        Cash is part of the same design. A book that is fully invested
        in a handful of names has no spare capital when prices disconnect
        from the original cases. Cash is not a market forecast. It is
        optionality to add, to pay a tax bill, or to do nothing. The
        right amount depends on the household, not on a model portfolio.
      </P>
      <P>
        Leverage, even informal leverage, changes the math. Margin,
        concentrated options, or a spending plan that requires the book
        to be up this year all turn ordinary volatility into a forced
        sale. Concentration already raises the odds that one name moves
        the whole result. Borrowing against that result is a second
        decision, and it is usually a worse one.
      </P>

      <H2>Write the Sell Conditions While You Still Can</H2>
      <P>
        A concentrated investor who has no exit language will invent it
        after the fact. The price will be down, the thesis will be
        restated in softer terms, and the holding will remain because
        selling would confirm an error. Better to decide in advance what
        would mean the original case is no longer true.{" "}
        <A href="/blog/when-to-sell-a-stock-thesis-broken">
          Sell when the thesis is broken
        </A>
        , not when the quote is uncomfortable.
      </P>
      <P>
        Thesis-break conditions should be observable: a lasting loss of
        customers, unit economics that no longer support reinvestment, a
        balance sheet that requires dilution, a competitive position that
        has clearly eroded, or capital allocation that no longer matches
        the original underwriting. One weak quarter is not automatically
        that evidence. A pattern that contradicts the mechanism usually
        is.
      </P>
      <P>
        Selling a winner because it became too large for the book is a
        different event. The company may still fit the thesis. The
        portfolio may not be able to absorb another large decline in that
        name. Those two facts can be true at once. Record which one
        drove the trade, or the next review will confuse a construction
        choice with a change of mind about the business.
      </P>

      <H2>Discipline Is the Part That Has to Last</H2>
      <P>
        The work of building concentrated stock portfolios does not end
        at purchase. It is a cadence: read the filings, update the
        written case, check overlap, and leave the weights alone unless
        one of those reviews requires a change. A slow cadence is a
        feature. Concentration is poorly suited to investors who need
        the portfolio to feel busy.
      </P>
      <P>
        Keep a record. The original thesis, the size, the risks you
        named, and the outcome are more useful than a stream of confident
        commentary. Over a few years that file becomes the only honest
        measure of whether concentration is earning its keep in your
        hands, as opposed to in someone else&apos;s lore.
      </P>
      <P>
        None of this is a promise that a short list of stocks will beat
        a broad index. Concentration raises both the chance of a large
        gain and the chance of a large hole. The investor&apos;s job is
        to make the hole survivable and the process repeatable. If you
        cannot explain why a name is in the book, why it is that size,
        and what would take it out, it is not a concentrated position.
        It is an opinion with a market value attached.
      </P>

      <InlineCTA href="/pricing" />

      <FAQList
        items={[
          {
            q: "What does building concentrated stock portfolios well actually require?",
            a: "It requires more than conviction. Choose a number of names you can follow with a written case, size each holding for a credible adverse case, and watch overlap across businesses rather than ticker count alone. Write the thesis and the exit conditions before you buy, then review on a schedule. Concentration is a construction process that has to be held over time, not a shorter version of a diversified list.",
          },
          {
            q: "How many stocks should a concentrated portfolio hold?",
            a: "Name count is a constraint, not the whole job. Too few names and a single error defines the year. Too many and the book starts to behave like the index you were trying to leave. For an active stock book, the practical band is usually in the teens to the mid-twenties, provided those businesses do not all fail for the same reason. If the list is longer than the hours available to maintain written cases, hold fewer companies or keep more of the household in a broad fund.",
          },
          {
            q: "How should you size positions in a concentrated book?",
            a: "Size for uncertainty, not for how sure you feel. Ask what a serious operational miss, a lower multiple, or a balance-sheet strain would do to the position and to the whole book. A 10% weight that falls 50% costs five points; a 25% weight that does the same costs twelve and a half. Recurring demand, a clean balance sheet, and a modest valuation can justify more weight than a case that needs refinancing or an optimistic multiple. Set a review threshold for winners before they become the book.",
          },
          {
            q: "How do you test a thesis before a position gets large?",
            a: "Write the claim down: the business, the price, the mechanism, and the conditions that would prove it wrong. The test is whether the current price leaves room to be right about the business and wrong about several details. A starter size can keep you honest while evidence accumulates. Adding is then a second underwriting. Revisit the case on a calendar and when filings or competitive facts change, not when a headline arrives.",
          },
          {
            q: "When should you sell a concentrated holding?",
            a: "Sell when facts invalidate the original case, not when the quote is uncomfortable. Observable breaks include a lasting loss of customers, unit economics that no longer support reinvestment, a balance sheet that requires dilution, or capital allocation that no longer matches the underwriting. Selling a winner because it became too large for the book is a construction choice and should be recorded as such, so the next review does not confuse it with a change of mind about the company.",
          },
          {
            q: "Is this financial advice?",
            a: "No. Outpick is educational research, not financial advice; past performance is not indicative of future results. Every reader makes their own decisions about whether and how to act on the research.",
          },
        ]}
      />

      <KeyTakeaway>
        <P>
          Building concentrated stock portfolios well is a construction
          job. Size for a survivable adverse case, write the thesis and
          the sell conditions before you buy, and watch the risks that
          ticker count does not show. The process has to last longer
          than the feeling that made you concentrate in the first place.
        </P>
      </KeyTakeaway>
    </Prose>
  ),
};

export default article;
