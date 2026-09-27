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
    slug: "what-good-stock-research-actually-looks-like",
    title: "What Good Stock Research Actually Looks Like",
    description:
      "A stock can look cheap and still be a poor investment. Good research is a testable thesis: business, price, cycle, downside, and a written audit trail.",
    keyword: "good stock research",
    keywords: [
      "stock research process",
      "investment thesis",
      "valuation",
      "cyclicality",
      "thesis invalidation",
      "audit trail",
    ],
    publishedAt: "2026-09-27",
    category: "Education",
    tags: ["research", "process", "long-term investing"],
    readingTime: 9,
    author: "Outpick Research",
    cover: "/art/covers/what-good-stock-research-actually-looks-like.png",
  },
  Content: () => (
    <Prose>
      <Lede>
        A stock can look cheap on a screen and still be a poor investment. It can report
        strong earnings and still be entering a weaker part of its cycle. It can be a fine
        business at a price that leaves no room for error. Good stock research exists to
        separate these possibilities before capital is committed.
      </Lede>

      <TLDR>
        <P>
          The job of research is not to predict every outcome. It is to build a case that
          is specific enough to test, sober enough to challenge, and clear enough to
          abandon when the evidence changes. That means the business, the gap at the
          current price, valuation tied to economics, the cycle, specific downside, and a
          written audit trail.
        </P>
      </TLDR>

      <P>
        That distinction matters because buying an individual stock is not an opinion
        about a chart or a quarter. It is a decision to own a partial interest in a
        business, at a particular price, through outcomes that will rarely unfold exactly
        as expected. The job of research is not to predict every outcome. It is to build
        a case that is specific enough to test, sober enough to challenge, and clear
        enough to abandon when the evidence changes.
      </P>

      <H2>Stock Research Starts With the Business</H2>
      <P>
        The first question is not whether a stock will outperform next quarter. It is
        what the company does, why customers choose it, and what allows it to earn a
        return above its cost of capital over time.
      </P>
      <P>
        A useful starting point is the economic engine. How does the company make money?
        Is revenue recurring, transactional, cyclical, or dependent on a small number of
        customers? Are margins supported by brand, switching costs, cost advantage,
        distribution, intellectual property, regulation, or a network effect? These are
        not academic labels. They explain why a business may sustain its economics or
        why competitors may erode them.
      </P>
      <P>
        Management commentary can help, but the financial statements should carry more
        weight. Revenue growth alone says little without context. A company can grow by
        cutting prices, adding debt-funded acquisitions, or selling into a temporary
        demand surge. Research should examine gross margin, operating margin, free cash
        flow conversion, returns on invested capital, share count, and debt obligations
        together.{" "}
        <Strong>The pattern matters more than one favorable metric.</Strong>
      </P>
      <P>
        For example, improving margins may reflect better scale and durable pricing
        power. They may also reflect a temporary reduction in marketing, maintenance
        spending, or headcount. The difference becomes clearer when the analyst asks
        what has changed in the underlying business and whether that change can persist.
      </P>

      <H2>A Strong Thesis Explains the Gap</H2>
      <P>
        Most investors can identify a good company. The harder question is why the
        opportunity exists at the current price.
      </P>
      <P>
        A sound investment thesis identifies a gap between market expectations and a
        more carefully supported view of future cash generation. Perhaps the market is
        treating a cyclical slowdown as permanent impairment. Perhaps a business
        improvement is visible in operating data but not yet reflected in consensus
        estimates. Perhaps a stable, cash-generative company is priced as though a known
        risk is likely to be catastrophic.
      </P>
      <P>
        This is where earnings revisions and sector context become useful. A low
        valuation is not automatically attractive if earnings estimates are still falling
        or the industry is headed into oversupply. Conversely, a company trading at a
        higher multiple may be reasonable if its returns, reinvestment runway, and
        earnings trajectory are materially better than they appear at first glance.
      </P>
      <P>
        The goal is not to find a clever contrarian story. It is to state what the
        market may be missing, why it may be missing it, and what evidence would show
        that the interpretation is wrong. If the thesis depends on several generous
        assumptions occurring at once, the{" "}
        <A href="/blog/when-to-sell-a-stock-thesis-broken">margin for error</A>
        {" "}
        is thin regardless of how compelling the narrative sounds.
      </P>

      <H2>Price Is Part of the Business Decision</H2>
      <P>
        Investors often split companies into &ldquo;quality&rdquo; and
        &ldquo;value&rdquo; as though the two cannot coexist. That framing misses the
        point. Quality affects the cash flows a business may produce. Valuation
        determines what an investor pays to participate in those cash flows.
      </P>
      <P>
        A valuation should be tied to the company&apos;s actual economics. For mature
        businesses, an investor may focus on normalized free cash flow, earnings power,
        capital intensity, and shareholder distributions. For a business still
        reinvesting heavily, the more relevant questions may be unit economics,
        incremental margins, the durability of growth, and the returns available on new
        capital.
      </P>
      <P>
        No single multiple settles the question. Price-to-earnings can be distorted by
        temporary margins, accounting items, or a capital structure that differs from
        peers. Enterprise value to EBIT can be useful, but it does not replace an
        assessment of cash conversion. A discounted cash flow model can make assumptions
        explicit, but a precise output does not make those assumptions precise.
      </P>
      <P>
        The practical test is simpler:{" "}
        <Strong>
          what must happen for the current price to provide an acceptable long-term
          return?
        </Strong>{" "}
        If the answer requires years of exceptional growth, permanently elevated
        margins, and a premium exit multiple, the investment may be priced for a
        favorable future already.
      </P>

      <H2>Stock Research Must Include the Cycle</H2>
      <P>
        Business quality does not eliminate cyclicality. Housing, industrials,
        semiconductors, energy, transportation, advertising, and many consumer
        categories can produce financial results that look durable near a peak and
        broken near a trough.
      </P>
      <P>
        <Strong>Cycle awareness is not market timing.</Strong> It is an attempt to
        avoid treating peak earnings as normal earnings, or trough earnings as permanent
        earnings. Research should consider capacity additions, inventories, pricing
        behavior, order trends, customer spending, and prior cycle history. It should
        also distinguish between a company-specific problem and a sector-wide reset.
      </P>
      <P>
        This is one reason a cross-sectional process is valuable. Reviewing companies
        against their sector peers can reveal whether an apparent improvement is
        idiosyncratic or merely the result of favorable industry conditions. It can
        also show when a weak business is being flattered by a strong cycle.
      </P>
      <P>
        Momentum has a role here, but not as a substitute for analysis. Improving price
        and estimate trends can indicate that business conditions are strengthening.
        They can also attract attention after much of the improvement is already priced
        in. Momentum is evidence to weigh alongside fundamentals and valuation, not an
        instruction to buy.
      </P>

      <H2>The Risk Section Is Not a Formality</H2>
      <P>
        <Strong>A thesis without downside analysis is usually a sales document.</Strong>{" "}
        Investors need to know not only what could go right, but what could cause
        permanent capital loss.
      </P>
      <P>
        The most useful risks are specific. Customer concentration, leverage,
        refinancing needs, regulatory exposure, technological displacement, weak
        governance, aggressive acquisition accounting, and fragile unit economics
        deserve more attention than generic statements about competition or
        macroeconomic uncertainty. A risk becomes actionable when it is connected to a
        measurable signal or a condition that would change the original case.
      </P>
      <P>
        Thesis-break conditions should be written before a position is opened. They
        might include a sustained loss of market share, a failure of expected margins to
        materialize, deteriorating returns on capital, a material change in
        balance-sheet risk, or evidence that a supposed competitive advantage was
        temporary.{" "}
        <Strong>Not every drawdown invalidates a thesis.</Strong> But every thesis
        should have a point at which the evidence no longer supports ownership.
      </P>
      <P>
        This discipline also helps distinguish a broken thesis from a disappointing
        stock price. Markets can remain wrong for longer than expected, and good
        investments can decline after purchase. Averaging down is only rational when
        the facts strengthen the expected return, not when the price alone becomes more
        emotionally appealing.
      </P>

      <H2>Research Should Leave an Audit Trail</H2>
      <P>
        The value of a research process compounds when decisions are documented. A
        written thesis establishes what was believed at purchase, what valuation was
        assumed, what risks were accepted, and what would change the conclusion.
        Without that record, it is easy to rewrite history after the fact.
      </P>
      <P>
        An accountable publication should show more than its winners. Position openings,
        trims, exits, and losses all provide evidence about process. The losses stay on
        the page because they reveal whether the original analysis missed something,
        whether a risk was underweighted, or whether an uncertain outcome simply went
        the other way.
      </P>
      <P>
        At Outpick, the purpose of a live example portfolio and documented decisions is
        not to offer a signal service or replace an investor&apos;s judgment. It is to
        make the reasoning inspectable. Subscribers can evaluate the work, including its
        mistakes, rather than relying on selective performance claims.
      </P>
      <P>
        For a self-directed investor, the same principle applies. Keep a short
        underwriting record for each holding. Revisit it when earnings arrive or the
        industry changes. If the original case no longer explains the facts, respect
        the evidence more than the purchase price.
      </P>
      <P>
        The best stock research does not promise certainty. It gives you a disciplined
        way to decide what you own, why you own it, what you paid, and what would make
        you change your mind. That is a more useful foundation for a{" "}
        <A href="/blog/how-many-stocks-should-you-hold-to-beat-the-market">
          concentrated portfolio
        </A>{" "}
        than any confident prediction.
      </P>

      <InlineCTA href="/pricing" />

      <FAQList
        items={[
          {
            q: "What does good stock research actually include?",
            a: "The business first: how it makes money, why customers stay, and whether returns on capital can persist. Then a thesis that explains the gap at the current price, a valuation tied to those economics, an honest read of the cycle, specific downside rather than generic risk language, and a written record of what was believed and what would change the conclusion.",
          },
          {
            q: "Is a cheap valuation enough to buy a stock?",
            a: "No. A low valuation is not automatically attractive if earnings estimates are still falling or the industry is headed into oversupply. Price is part of the business decision. The practical test is what must happen for the current price to provide an acceptable long-term return. If the answer already assumes exceptional growth, permanently elevated margins, and a premium exit multiple, the stock may be priced for a favorable future.",
          },
          {
            q: "How do you write an investment thesis?",
            a: "State the gap between market expectations and a more carefully supported view of future cash generation — what the market may be missing, why it may be missing it, and what evidence would show the interpretation is wrong. Identifying a good company is not enough. If the case depends on several generous assumptions occurring at once, the margin for error is thin regardless of how compelling the narrative sounds.",
          },
          {
            q: "When is a thesis invalidated versus a temporary price drop?",
            a: "Not every drawdown invalidates a thesis. Write the break conditions before a position is opened: a sustained loss of market share, expected margins that fail to materialize, deteriorating returns on capital, a material change in balance-sheet risk, or evidence that a supposed advantage was temporary. Averaging down is only rational when the facts strengthen the expected return, not when the price alone becomes more emotionally appealing.",
          },
          {
            q: "Why keep a research audit trail?",
            a: "A written thesis records what was believed at purchase, what valuation was assumed, what risks were accepted, and what would change the conclusion. Without that record it is easy to rewrite history after the fact. Losses belong in the same record as winners: they show whether the original analysis missed something, underweighted a risk, or simply met an uncertain outcome that went the other way.",
          },
          {
            q: "Is Outpick financial advice?",
            a: "No. Outpick is educational research, not financial advice; past performance is not indicative of future results. Every reader makes their own decisions about whether and how to act on the research.",
          },
        ]}
      />

      <KeyTakeaway>
        <P>
          The best stock research does not promise certainty. It gives you a disciplined
          way to decide what you own, why you own it, what you paid, and what would make
          you change your mind. Write the business, the gap, the price, the cycle, the
          downside, and the audit trail before capital is committed.
        </P>
      </KeyTakeaway>
    </Prose>
  ),
};

export default article;
