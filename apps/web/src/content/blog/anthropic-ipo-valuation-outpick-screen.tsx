import type { Article } from "@/lib/blog";
import { YouTubeEmbed } from "@/components/blog/youtube-embed";
import {
  Prose,
  Lede,
  H2,
  H3,
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

const VIDEO_ID = "-9N_LqXWnPY";
const VIDEO_TITLE =
  "Anthropic IPO valuation: Outpick's five-factor screen of the prospectus";

const article: Article = {
  meta: {
    slug: "anthropic-ipo-valuation-outpick-screen",
    title:
      "Anthropic IPO valuation: a five-factor screen of the $2T prospectus",
    description:
      "Outpick screens Anthropic's IPO prospectus at a $2T ask: accounting vs operating loss, five factors, and the $518B compute bill. Education, not advice.",
    keyword: "Anthropic IPO valuation",
    keywords: [
      "Anthropic IPO prospectus",
      "Anthropic $2 trillion valuation",
      "Anthropic IPO analysis",
      "five-factor stock screen",
      "Anthropic compute costs",
    ],
    publishedAt: "2026-09-29",
    category: "Research",
    subcategory: "company-research",
    tags: ["anthropic", "ipo", "valuation", "research"],
    readingTime: 10,
    author: "Outpick Research",
    cover: "/art/covers/anthropic-ipo-valuation-outpick-screen.png",
  },
  Content: () => (
    <Prose>
      <Lede>
        Reuters reported a confidential Anthropic IPO prospectus that asks public
        investors to underwrite more than <Strong>$2 trillion</Strong>. Last year
        the company took in <Strong>$4.6 billion</Strong> and booked a{" "}
        <Strong>$42 billion</Strong> loss. The question is not whether Claude is
        a remarkable product. It is whether that Anthropic IPO valuation is a
        price for the business as it stands, or a price for 2028 arriving on
        time.
      </Lede>

      <TLDR>
        <P>
          Most of the $42 billion loss is an accounting revaluation of earlier
          funding promises, not cash leaving the till. The operating loss was
          still <Strong>$8.06 billion</Strong> on $4.6 billion of revenue. Growth
          and the company&apos;s own outlook pass our five-factor screen.
          Profitability and valuation do not: there is no full profitable year
          yet, and $2 trillion prices roughly <Strong>43 times</Strong> a
          run-rate built from one quarter, or about <Strong>10 times</Strong>{" "}
          2028 revenue the company has not earned. The number that decides the
          book is a <Strong>$518 billion</Strong> compute bill, largely
          non-cancellable, against <Strong>$20.28 billion</Strong> of cash at
          year-end. Verdict: an exceptional business that does not clear the bar
          at that price. Education, not a recommendation to buy or skip the IPO.
        </P>
      </TLDR>

      <Callout variant="warning" title="Education, not advice">
        <P>
          This note restates a public screen. We do not own Anthropic. Nothing
          here is financial advice, and nothing here is a recommendation to buy
          the IPO or skip it. Figures come from the prospectus as{" "}
          <A href="https://www.cnbc.com/2026/09/28/anthropics-ipo-prospectus-shows-sweeping-ai-vision-surging-costs-reuters.html">
            reported by Reuters
          </A>
          ; the company has not, as of this writing, posted a public filing.
          When it does, read that document rather than this summary.
        </P>
      </Callout>

      <YouTubeEmbed
        videoId={VIDEO_ID}
        title={VIDEO_TITLE}
        publishedAt="2026-09-29"
      />

      <H2>The $42 billion loss is mostly not the operating loss</H2>
      <P>
        Start with the headline because it is doing too much work. About{" "}
        <Strong>$34 billion</Strong> of the $42 billion is an accounting charge
        tied to earlier funding deals that can convert into Anthropic shares
        later. As the private mark rose — from <Strong>$61.5 billion</Strong> in
        March 2025 to <Strong>$965 billion</Strong> this May — those promises
        became more valuable on paper. The accountant books the jump as a loss
        even though no cash left the till. That is a real line on an income
        statement. It is not a description of how the business spent last year.
      </P>
      <P>
        The number that describes the business is the operating loss:{" "}
        <Strong>$8.06 billion</Strong>, up from $2.98 billion the year before.
        Anthropic brought in $4.6 billion and spent $12.65 billion. Compute —
        chips and data centers that train and run Claude — was{" "}
        <Strong>$7.33 billion</Strong> of that spend. For every dollar a
        customer paid, the company spent about $2.75; roughly $1.60 of that went
        to compute. The rest of the $42 billion is the price going up. The
        operating book still lost $8 billion, and it lost it buying compute.
      </P>

      <StatGrid
        stats={[
          { label: "2025 REVENUE", value: "$4.6B" },
          { label: "OPERATING LOSS", value: "$8.06B" },
          { label: "IPO ASK", value: ">$2T" },
          { label: "COMPUTE BILL", value: "$518B" },
        ]}
      />

      <H2>How we screen the Anthropic IPO valuation</H2>
      <P>
        Every two weeks we rescore roughly 3,600 US-listed companies on the same
        five factors — growth, estimate revisions, profitability, valuation, and
        momentum — each measured against the company&apos;s own sector. The
        method is on the{" "}
        <A href="/strategy">strategy page</A>. Anthropic is not listed, and it
        does not yet have a sector in that universe. It may be the first
        frontier AI lab to list. The honest move is still to run the same
        questions on the prospectus numbers rather than invent a special screen
        because the story is large.
      </P>
      <P>
        That is{" "}
        <A href="/blog/what-good-stock-research-looks-like">
          what good stock research looks like
        </A>
        : the business, the gap at the current price, valuation tied to
        economics, specific downside, and a written trail of what would change
        the conclusion. A $2 trillion ask is not a reason to skip the work. It
        is a reason to do it slowly.
      </P>

      <H3>Growth — pass</H3>
      <P>
        Revenue grew twelvefold in 2025. Bloomberg then reported more than{" "}
        <Strong>$11.5 billion</Strong> of revenue in the second quarter of 2026
        against $787 million a year earlier. One quarter this year brought in
        about two and a half times all of last year. The prospectus, as
        described in the video, ties usage — and therefore revenue — to new
        models, with a continuous and overlapping cadence of releases as the
        cost of staying at the frontier.
      </P>
      <P>
        The timing around that claim is awkward in a useful way. In early
        September the CEO published a long essay asking the industry to pace the
        frontier. Ten days later Anthropic released Opus 5.5, and on the Monday
        Reuters reported the prospectus it released Sonnet 5.5. On Artificial
        Analysis&apos;s intelligence index those were the two best-scoring
        models released to date in that snapshot (Opus 58, Sonnet 56, against
        OpenAI&apos;s GPT-6 Astra at 53). Growth at this scale passes any bar
        we use on listed names. It does not, by itself, set the price.
      </P>

      <H3>Estimate revisions — pass</H3>
      <P>
        No sell-side roster covers Anthropic yet. The closest substitute is
        whether the company&apos;s own numbers keep getting raised. The revenue
        run rate — the current pace annualized — was about{" "}
        <Strong>$9 billion</Strong> at the end of 2025, more than{" "}
        <Strong>$47 billion</Strong> by May, and <Strong>$65 billion</Strong> by
        the end of July. It told investors to expect at least $10.9 billion in
        the second quarter, then came in above $11.5 billion. That is the
        shape we look for in revisions: the outlook is moving up, not being
        defended. It passes. It is still a private company talking about its
        own run rate, not a consensus of independent estimates.
      </P>

      <H3>Profitability — fail</H3>
      <P>
        Full-year 2025 operating margin was about <Strong>minus 175%</Strong>.
        This year the print is turning. For the second quarter Anthropic
        projected its first operating profit, about{" "}
        <Strong>$559 million</Strong>, and subsequent reporting has it on track
        for a second profitable quarter. That profit is adjusted. Adjusted
        usually means some costs sit outside the headline — typically stock
        paid to employees. A public income statement has to include them. We
        score the full number. There is not a full profitable year yet.
        Profitability fails on that test, even if the sequential path is the
        first sign the cost of compute might be growing slower than revenue.
      </P>

      <H3>Valuation — fail</H3>
      <P>
        Take the second quarter, multiply by four, and Anthropic is running at
        about <Strong>$46 billion</Strong> a year. Two trillion is about{" "}
        <Strong>43 times</Strong> that. In the comps we used in the video,
        Palantir — one of the more expensive listed software names — traded
        around 53 times this year&apos;s expected revenue; SpaceX and Cloudflare
        around 41.6 times. The unusual step, per Reuters, is that the bankers
        are not selling that 43-times print. They are pricing Anthropic on
        revenue two years out. The company is projecting{" "}
        <Strong>$190 to $200 billion</Strong> for 2028. On that number, $2
        trillion is about <Strong>10 times sales</Strong>.
      </P>
      <P>
        That is like pricing a house on the rent it will earn after you build
        the third floor. The floor might get built. You still pay for it today.
        Our framework wants a{" "}
        <A href="/blog/value-investing-more-than-cheap-stocks">
          margin of safety
        </A>
        : a price below a conservative view of what the business is worth now,
        because the underwriter can be wrong and because markets can stay
        skeptical longer than a model likes. Priced on 2028, there is not one.
        Valuation fails. That is the whole argument against treating the
        Anthropic IPO valuation as a bargain because a 2028 multiple looks
        tidier than a 2026 one.
      </P>

      <H3>Momentum — cannot score</H3>
      <P>
        Momentum needs a public stock. What exists instead is a string of
        private marks: $61.5 billion in March 2025, $183 billion that September,
        $380 billion in February, $965 billion in May, and now more than $2
        trillion. That is roughly <Strong>32 times</Strong> in eighteen months.
        The nearest listed comparison in the video was SpaceX, which went
        public in June at $135 a share, closed its first day at $160, and later
        traded around $147: the IPO allocation was up; the first-day excitement
        was not. Until Anthropic trades, momentum is a blank. We leave it
        blank.
      </P>

      <CompareTable
        headers={["Factor", "Score", "What the prospectus is saying"]}
        rows={[
          [
            "Growth",
            "Pass",
            "Twelvefold 2025 revenue; one 2026 quarter ~2.5× all of last year",
          ],
          [
            "Estimate revisions",
            "Pass",
            "Run rate ~$9B → $65B; Q2 guided ≥$10.9B, printed >$11.5B",
          ],
          [
            "Profitability",
            "Fail",
            "2025 operating margin ~−175%; no full unadjusted profitable year",
          ],
          [
            "Valuation",
            "Fail",
            "$2T is ~43× a Q2 run-rate, ~10× 2028 sales that are still a forecast",
          ],
          [
            "Momentum",
            "Unscored",
            "No listing yet; private marks ~32× in 18 months",
          ],
        ]}
      />

      <P>
        Two passes, two fails, and one we cannot score. On listed names that
        shape is usually a maybe. The number that decides this book is not a
        fifth factor. It is the bill already signed.
      </P>

      <H2>The $518 billion compute bill</H2>
      <P>
        Anthropic expects to spend <Strong>$518 billion</Strong> on computing
        infrastructure over about a decade, with six partners. It held{" "}
        <Strong>$20.28 billion</Strong> in cash and short-term investments at
        the end of last year. The largest pieces in the video&apos;s read of
        the prospectus are about $161 billion in equipment leases tied to
        Broadcom, $111 billion with Google, $110 billion with Amazon, and $31
        billion with Microsoft. About <Strong>80%</Strong> of the total is
        non-cancellable, or has to be paid whether Anthropic uses the compute
        or not. In the prospectus&apos;s own language as quoted on the tape: if
        actual spend falls short, it must pay Google the difference. The Amazon
        deal works the same way.
      </P>
      <P>
        The first thing we check in any business is whether cash flow can fund
        the plan without going back to the capital markets. At this scale,
        Anthropic&apos;s cannot. That is what the IPO is for. A $2 trillion
        mark is not only a story about Claude. It is a story about who funds a
        decade of chips when the customer checks are still a fraction of the
        committed spend.
      </P>
      <P>
        The counterparties are not only suppliers. Amazon and Google have each
        invested billions in Anthropic. They sell the compute. They sell Claude
        to their own cloud customers. They build competing models. The
        prospectus calls them investors, customers, cloud providers,
        distributors, and competitors at once, with incentives that may not be
        fully aligned. Customers are concentrated too: nearly a quarter of last
        year&apos;s revenue came from just two of them, and the filing warns
        that many of its largest clients are not locked into long-term
        contracts. The bill is fixed for ten years. A quarter of the revenue is
        not.
      </P>
      <P>
        Then there are the risk factors — 80 of the prospectus&apos;s 261
        pages, against about 38 of 277 in SpaceX&apos;s filing. Anthropic warns
        that advanced AI could pose catastrophic or existential risks to
        humanity, and that its models could show self-preserving behavior,
        including attempts to resist shutdown. Reuters noted that few companies
        have ever put a warning like that in an IPO document. It is not a
        valuation input in our model. It is part of the audit trail: the
        company is asking public shareholders to fund a product it describes,
        in its own risk section, as potentially existential.
      </P>

      <H2>The strongest case against our verdict</H2>
      <P>
        The pushback is the growth itself. Anthropic says its revenue run rate
        grew more than tenfold a year in each of the three years through early
        2026. If it hits even the low end of its 2028 forecast, $2 trillion is
        about 10 times revenue — cheaper, on that multiple, than Palantir was
        in the comps we used. Bankers are betting that revenue rises faster
        than the cost of compute, and the second quarter is the first sign
        that it can. If they are right, $2 trillion will look cheap in
        hindsight. That is a coherent thesis. It is also a thesis that requires
        2028 to show up on time, with margins the full-year statements have not
        yet shown, while a mostly non-cancellable $518 billion bill is already
        on the table.
      </P>
      <P>
        Index investors already sit on one side of that bill. A market-cap
        S&amp;P 500 fund holds Amazon, Google, and Microsoft. Between them,
        Anthropic has promised more than $250 billion in minimum spending.
        Amazon and Google are also shareholders. The fund already rides on
        Anthropic paying. Direct IPO stock would be a second, more concentrated
        claim on the same stack — lab equity on top of the suppliers and
        cloud platforms already in the index. That is a portfolio construction
        question, not a forecast.
      </P>
      <P>
        For our own model, nothing changes yet. It scores listed companies with
        public filings. When Anthropic&apos;s filing goes public and the stock
        trades, it enters the same screen as the other 3,600. Until then the
        honest sentence is the one the video ends on: go back to the $42
        billion loss; most of it was accounting. The numbers that matter are
        $518 billion already signed, and a $2 trillion price that assumes 2028
        arrives on schedule.
      </P>

      <Callout variant="info" title="Facebook was an exceptional business too">
        <P>
          The 2012 Facebook IPO is the useful analogy, not because the
          businesses are the same, but because an exceptional franchise still
          left day-one buyers underwater for about fourteen months. Quality
          does not redeem a price. It is the thing you underwrite{" "}
          <Strong>at</Strong> a price.
        </P>
      </Callout>

      <P>
        Two factors pass, two fail, and one cannot be scored yet. On our
        framework, Anthropic is an exceptional business that does not clear the
        bar at that Anthropic IPO valuation. Every two weeks we publish the one
        US-listed name that does — full written thesis, the risks, and what
        would prove us wrong. Returns are public, losers included, on the{" "}
        <A href="/track-record">track record</A>. Through December 1, 2026, the
        founding year is $250; the list is on{" "}
        <A href="/pricing">pricing</A>.
      </P>

      <InlineCTA
        heading="The names that do clear the bar"
        body="Outpick publishes one US-listed business every two weeks with the full thesis, the risks, and what would prove us wrong — then tracks the live book in public. Founders: $250/year through December 1, 2026 · then $1,000/year."
        cta="SEE PRICING"
        href="/pricing"
      />

      <FAQList
        items={[
          {
            q: "What is Anthropic's IPO valuation in the prospectus Reuters saw?",
            a: "The confidential prospectus, as reported by Reuters, asks public investors to value Anthropic at more than $2 trillion. That is more than double the company's own $965 billion mark from May 2026. It is an ask, not a priced deal, and not a public S-1 as of this note.",
          },
          {
            q: "Did Anthropic really lose $42 billion last year?",
            a: "It booked a $42 billion net loss. About $34 billion of that is described as an accounting charge from earlier funding instruments that revalue as the private mark rises. The operating loss — the cost of running the business — was $8.06 billion on $4.6 billion of revenue, with $7.33 billion spent on compute.",
          },
          {
            q: "Does a $2 trillion Anthropic IPO valuation look cheap on 2028 revenue?",
            a: "On the company's $190–$200 billion 2028 projection, $2 trillion is about 10 times sales. On a 2026 run-rate built from one strong quarter, it is about 43 times. Our screen wants a margin of safety against the business as it stands, not against a year that has not been earned. A tidier 2028 multiple does not create that margin today.",
          },
          {
            q: "What is the $518 billion compute bill?",
            a: "It is the multi-year computing and infrastructure commitment described in the prospectus — on the order of a decade, across six partners — not a single year's expense. Roughly 80% is non-cancellable or take-or-pay. Year-end cash was $20.28 billion. Cash flow cannot fund that plan without the capital markets; that is the purpose of the IPO.",
          },
          {
            q: "Is this a recommendation to buy or skip the Anthropic IPO?",
            a: "No. This is educational research, not financial advice, and not a recommendation to buy the IPO or skip it. We do not own Anthropic. When the public filing is posted, read that document. Any decision to participate is yours.",
          },
          {
            q: "Is Outpick financial advice?",
            a: "No. Outpick is educational research, not financial advice; past performance is not indicative of future results. Every reader makes their own decisions about whether and how to act on the research.",
          },
        ]}
      />

      <KeyTakeaway>
        <P>
          Separate the accounting loss from the operating loss, then score the
          Anthropic IPO valuation the same way you would a listed name. Growth
          and a rising internal outlook pass. Profitability and a price that
          assumes 2028 do not. The $518 billion compute bill, mostly
          non-cancellable, is what the IPO is for. Exceptional business; the
          bar at that price is not cleared. That is a research conclusion, not
          a buy or skip order.
        </P>
      </KeyTakeaway>
    </Prose>
  ),
};

export default article;
