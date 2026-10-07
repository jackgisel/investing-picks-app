import type { Article } from "@/lib/blog";
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
  KeyTakeaway,
  InlineCTA,
  FAQList,
  TLDR,
} from "@/components/blog/prose";

const article: Article = {
  meta: {
    slug: "investment-thesis-template",
    title: "Investment Thesis Template for Stock Research",
    description:
      "Use this investment thesis template to assess a business, price its risks, define what would change your mind, and make better stock decisions over time.",
    keyword: "investment thesis template",
    keywords: [
      "investment thesis template",
      "stock research",
      "underwriting",
      "valuation",
      "thesis-break",
      "long-term investing",
    ],
    publishedAt: "2026-10-03",
    category: "Education",
    subcategory: "research-process",
    tags: ["investment thesis", "stock research", "underwriting", "process"],
    readingTime: 7,
    author: "Outpick Research",
    cover: "/art/covers/investment-thesis-template.png",
  },
  Content: () => (
    <Prose>
      <Lede>
        A stock can look cheap, grow quickly, and still be a poor investment.
        The missing question is usually not whether the company has good
        attributes. It is whether the current price leaves room for an investor
        to be right about the business and wrong about several details. An{" "}
        <Strong>investment thesis template</Strong> forces that question onto
        the page before capital is committed.
      </Lede>

      <TLDR>
        <P>
          Write the thesis as an underwriting document, not a justification for
          a ticker you already own. Start with the business rather than the
          symbol, state why the market may be wrong, underwrite a range of
          financial outcomes, and put valuation in context. Define observable
          thesis-break conditions, keep answers short enough to challenge, and
          update the original document as evidence arrives.
        </P>
      </TLDR>

      <P>
        The purpose is not to produce a polished narrative that justifies a
        ticker already in your portfolio. It is to create an underwriting
        document: a concise, testable record of why the business may compound
        value, why the market may be mispricing it, what can go wrong, and what
        evidence would prove the original view mistaken.
      </P>

      <H2>What an Investment Thesis Template Should Do</H2>
      <P>
        A useful template creates a separation between facts, assumptions, and
        conclusions. That separation matters because most investment errors
        begin when an investor treats a plausible story as established fact.
      </P>
      <P>
        The template should also be reusable. If every company is evaluated
        with a different set of questions, comparison becomes difficult and
        conviction can become a function of how persuasive the writing sounds.
        A consistent structure does not eliminate judgment. It makes judgment
        easier to inspect.
      </P>
      <P>
        This is not a price-target worksheet or a trade plan. For a long-term
        owner, the central output is a view on business value and the
        conditions required for that value to grow. The stock price matters at
        purchase, but it is only one part of the underwriting.
      </P>

      <H2>Start With the Business, Not the Ticker</H2>
      <P>
        Write the first section as if the stock symbol did not exist. State
        what the company sells, who pays for it, why customers choose it, and
        how it earns a return on the capital it employs. If those answers
        require jargon, the business may not yet be understood well enough to
        own.
      </P>
      <P>
        A good description identifies the economic engine. A software company
        may earn recurring revenue from mission-critical workflows. A
        distributor may earn thin margins but turn inventory quickly and use
        its scale to provide better availability. A manufacturer may depend on
        a cost advantage, proprietary process, or service network. Revenue
        growth alone does not reveal which of these businesses is durable.
      </P>

      <H3>Questions Worth Answering</H3>
      <P>
        Explain the customer problem, the source of pricing power, and the
        reason competitors cannot easily take the economics away. Then identify
        the variables that drive revenue, margins, and free cash flow. For some
        companies, unit growth is decisive. For others, utilization, commodity
        spreads, credit losses, reimbursement rates, or advertising demand may
        matter more.
      </P>
      <P>
        The point is to locate the few operating facts that will determine
        whether the thesis works. A company can report impressive earnings
        while its core economics deteriorate. Conversely, a temporary earnings
        decline may be tolerable if the underlying franchise is strengthening.
      </P>

      <H2>State Why the Market May Be Wrong</H2>
      <P>
        The most important sentence in a thesis is often the simplest: what
        does the market appear to believe that you do not?
      </P>
      <P>
        A company may be discounted because earnings are cyclically weak,
        because a recent acquisition has obscured its normalized economics, or
        because a temporary cost issue has compressed margins. Those can be
        legitimate opportunities, but only if the problem is temporary and the
        balance sheet can withstand the period required for recovery.
      </P>
      <P>
        Sometimes the market is not wrong. It may be correctly assigning a low
        multiple to a business with declining returns, a weak competitive
        position, or capital needs that consume most of its reported earnings.
        &ldquo;Cheap&rdquo; is{" "}
        <A href="/blog/value-investing-more-than-cheap-stocks">
          not a thesis
        </A>
        . It is a starting observation.
      </P>
      <P>
        Be specific about the expected reappraisal. It could come from
        improving margins, a return to normal demand, evidence that an
        investment cycle is producing returns, debt reduction, or simply
        several quarters in which the business performs better than the market
        expects. If the catalyst is only &ldquo;investors will notice,&rdquo;
        the work is incomplete.
      </P>

      <H2>Underwrite the Financial Outcome</H2>
      <P>
        Financial analysis should connect directly to the business explanation.
        Avoid treating a spreadsheet as a separate exercise from the operating
        reality.
      </P>
      <P>
        Begin with a multiyear view of revenue, operating margin, free cash
        flow, returns on invested capital, and share count. Ask what changed
        and why. A rising margin is more meaningful when it reflects a
        structural improvement in mix or cost position than when it results
        from temporarily restrained spending. A high return on capital deserves
        scrutiny if it is supported by underinvestment, unusually favorable
        working capital, or a balance sheet that hides required reinvestment.
      </P>
      <P>
        Then build a base case with a limited number of explicit assumptions.
        Estimate a reasonable range for revenue growth, normalized margin,
        reinvestment needs, and the multiple or cash yield a buyer might accept
        at the end of the holding period. The output should be a range of
        values, not a false point estimate.
      </P>
      <P>
        The bear case matters just as much. What happens if revenue stalls,
        margins fail to recover, or capital spending stays elevated? Can the
        business service debt and preserve its competitive position? A thesis
        with attractive upside but no credible downside work is not disciplined
        research.
      </P>

      <H2>Put Valuation in Context</H2>
      <P>
        Valuation is not a vote on whether a company is good. It is the price
        paid for a stream of uncertain future cash flows.
      </P>
      <P>
        Use the metric that best reflects the company&apos;s economics.
        Enterprise value to operating profit can be useful for stable operating
        businesses. Free-cash-flow yield may be more informative where capital
        intensity is central. Price to book can have relevance for financial
        firms, provided asset quality and underwriting discipline are
        understood. No multiple works in isolation.
      </P>
      <P>
        Compare the current valuation with the company&apos;s own history,
        appropriate peers, and the return profile implied by your assumptions.
        A premium valuation can be sensible for a business that reinvests at
        high returns for a long runway. A low valuation can be expensive if
        earnings are at a cyclical peak or the franchise is eroding.
      </P>
      <P>
        Also consider opportunity cost. A position does not need to be a bad
        business to be a bad use of capital. The relevant question is whether
        the expected return, adjusted for uncertainty, is better than the
        alternatives available in the portfolio.
      </P>

      <H2>Define Risks and Thesis-Break Conditions</H2>
      <P>
        Risk is not a generic disclaimer at the end of a report. It is the
        section that determines whether the thesis deserves capital at all.
      </P>
      <P>
        Separate ordinary uncertainty from invalidation. Ordinary uncertainty
        includes a weak quarter, a delayed product launch, or temporary
        multiple compression. Invalidation means the{" "}
        <A href="/blog/when-to-sell-a-stock-thesis-broken">
          core logic has broken
        </A>
        : customers are leaving for a structurally better alternative, pricing
        power has disappeared, leverage is becoming unmanageable, or management
        is allocating capital in a way that permanently impairs value.
      </P>
      <P>
        Write these conditions in observable terms. &ldquo;Competition
        increases&rdquo; is too vague. &ldquo;Customer retention falls below a
        stated range for multiple periods while sales costs rise&rdquo; is more
        useful. A condition should tell you what to monitor and what would
        require a fresh underwriting rather than a reflexive decision to
        average down.
      </P>
      <P>
        Management belongs here as well. Assess incentives, capital allocation
        record, share issuance, acquisition discipline, and candor. A capable
        operator can still make a poor capital allocator. When the thesis
        depends heavily on management judgment, that dependence should be
        stated plainly.
      </P>

      <H2>A Practical Investment Thesis Template</H2>
      <P>
        Use the following prompts to produce a first draft. Keep each answer
        short enough that its logic can be challenged.
      </P>
      <UL>
        <LI>
          <Strong>Business:</Strong> What does the company sell, who pays, and
          what drives its economic returns?
        </LI>
        <LI>
          <Strong>Quality:</Strong> What protects its position, and how durable
          is that protection?
        </LI>
        <LI>
          <Strong>Market view:</Strong> What concern appears embedded in the
          current valuation?
        </LI>
        <LI>
          <Strong>Variant view:</Strong> Why might that concern be overstated,
          temporary, or already priced in?
        </LI>
        <LI>
          <Strong>Financial case:</Strong> What must happen to revenue,
          margins, cash flow, and capital needs?
        </LI>
        <LI>
          <Strong>Valuation:</Strong> What range of business value follows from
          realistic base and bear assumptions?
        </LI>
        <LI>
          <Strong>Catalyst:</Strong> What operating evidence could narrow the
          gap between price and value?
        </LI>
        <LI>
          <Strong>Risks:</Strong> What are the two or three most consequential
          ways the analysis could be wrong?
        </LI>
        <LI>
          <Strong>Invalidation:</Strong> What specific facts would break the
          thesis?
        </LI>
        <LI>
          <Strong>Decision:</Strong> At the current price, does the prospective
          return justify the uncertainty and the opportunity cost?
        </LI>
      </UL>
      <P>
        The final decision does not need to be buy or avoid. &ldquo;Watch and
        wait&rdquo; is often the correct result when a good business lacks a
        sufficient margin of safety, when key evidence is still missing, or
        when the thesis relies on a recovery that has not yet begun.
      </P>
      <P>
        A template earns its value when the market becomes uncomfortable. Keep
        the original document,{" "}
        <A href="/blog/long-term-investing-written-thesis">
          update the facts
        </A>
        , and compare what happened with what you expected. The losses should
        stay on the page, because they are often where the process improves.
      </P>

      <InlineCTA href="/pricing" />

      <FAQList
        items={[
          {
            q: "What should an investment thesis template do?",
            a: "A useful template separates facts, assumptions, and conclusions so a plausible story is not treated as established fact. It should be reusable: if every company is evaluated with a different set of questions, comparison becomes difficult and conviction can become a function of how persuasive the writing sounds. A consistent structure does not eliminate judgment. It makes judgment easier to inspect. This is not a price-target worksheet or a trade plan. For a long-term owner, the central output is a view on business value and the conditions required for that value to grow.",
          },
          {
            q: "Why start with the business rather than the ticker?",
            a: "Write the first section as if the stock symbol did not exist. State what the company sells, who pays for it, why customers choose it, and how it earns a return on the capital it employs. If those answers require jargon, the business may not yet be understood well enough to own. A good description identifies the economic engine — recurring revenue from mission-critical workflows, thin margins with fast inventory turns, a cost advantage, a proprietary process, or a service network. Revenue growth alone does not reveal which of these businesses is durable.",
          },
          {
            q: 'Why is "cheap" not an investment thesis?',
            a: 'The most important sentence in a thesis is often the simplest: what does the market appear to believe that you do not? A company may be discounted because earnings are cyclically weak, a recent acquisition has obscured normalized economics, or a temporary cost issue has compressed margins. Those can be legitimate opportunities only if the problem is temporary and the balance sheet can withstand the recovery period. Sometimes the market is not wrong: it may be correctly assigning a low multiple to declining returns, a weak competitive position, or capital needs that consume most reported earnings. "Cheap" is a starting observation, not a thesis.',
          },
          {
            q: "How should you underwrite the financial outcome?",
            a: "Connect financial analysis to the business explanation rather than treating a spreadsheet as a separate exercise. Begin with a multiyear view of revenue, operating margin, free cash flow, returns on invested capital, and share count, and ask what changed and why. Build a base case with a limited number of explicit assumptions and estimate a range for revenue growth, normalized margin, reinvestment needs, and the multiple or cash yield a buyer might accept. The output should be a range of values, not a false point estimate. The bear case matters just as much: a thesis with attractive upside but no credible downside work is not disciplined research.",
          },
          {
            q: "How should valuation be put in context?",
            a: "Valuation is not a vote on whether a company is good. It is the price paid for a stream of uncertain future cash flows. Use the metric that best reflects the company's economics: enterprise value to operating profit for stable operating businesses, free-cash-flow yield where capital intensity is central, or price to book for financial firms when asset quality and underwriting discipline are understood. No multiple works in isolation. Compare the current valuation with the company's history, appropriate peers, and the return profile implied by your assumptions. Also consider opportunity cost: a position does not need to be a bad business to be a bad use of capital.",
          },
          {
            q: "What is the difference between ordinary uncertainty and thesis invalidation?",
            a: "Ordinary uncertainty includes a weak quarter, a delayed product launch, or temporary multiple compression. Invalidation means the core logic has broken: customers are leaving for a structurally better alternative, pricing power has disappeared, leverage is becoming unmanageable, or management is allocating capital in a way that permanently impairs value. Write these conditions in observable terms. \"Competition increases\" is too vague. \"Customer retention falls below a stated range for multiple periods while sales costs rise\" is more useful. A condition should tell you what to monitor and what would require a fresh underwriting rather than a reflexive decision to average down.",
          },
          {
            q: "What belongs in a practical investment thesis template?",
            a: "Keep each answer short enough that its logic can be challenged. Cover the business, quality and durability of protection, the market view embedded in the valuation, your variant view, the financial case, a range of values from realistic base and bear assumptions, the operating evidence that could narrow the gap between price and value, the two or three most consequential ways the analysis could be wrong, specific invalidation facts, and whether the prospective return at the current price justifies the uncertainty and opportunity cost. The final decision does not need to be buy or avoid. \"Watch and wait\" is often correct when a good business lacks a sufficient margin of safety, key evidence is still missing, or the thesis relies on a recovery that has not yet begun.",
          },
          {
            q: "Is Outpick financial advice?",
            a: "No. Outpick is educational research, not financial advice; past performance is not indicative of future results. Every reader makes their own decisions about whether and how to act on the research.",
          },
        ]}
      />

      <KeyTakeaway>
        <P>
          A template earns its value when the market becomes uncomfortable.
          Keep the original document, update the facts, and compare what
          happened with what you expected. The losses should stay on the page,
          because they are often where the process improves.
        </P>
      </KeyTakeaway>
    </Prose>
  ),
};

export default article;
