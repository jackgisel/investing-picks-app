import type { Insight } from "@/lib/insights";
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
  TLDR,
} from "@/components/blog/prose";

const insight: Insight = {
  meta: {
    slug: "skwd-skyward-specialty-pc-insurer",
    title: "Stock buy: Skyward Specialty is building a broader specialty P&C platform",
    description:
      "Skyward Specialty underwrites niche commercial risks in the U.S. and, via Apollo, at Lloyd’s — a specialty insurer diversifying premium and fee income after a transformative acquisition.",
    ticker: "SKWD",
    postType: "pick",
    publishedAt: "2026-07-02",
    readingTime: 7,
    author: "Outpick Research",
    tags: ["insurance", "specialty P&C", "Lloyd's"],
  },
  Content: () => (
    <Prose>
      <Lede>
        Specialty insurance rewards underwriters who know a niche better than the market.
        Skyward&apos;s evolution is about collecting more of those niches — including a
        Lloyd&apos;s platform — without losing the underwriting plot.
      </Lede>

      <TLDR>
        <UL>
          <LI>
            Skyward Specialty (SKWD) is a specialty P&amp;C insurer serving commercial
            customers in niche and hard-to-place risks.
          </LI>
          <LI>
            Beginning in 2026, results report Skyward Specialty and Apollo (Lloyd&apos;s)
            segments separately, reflecting a broader platform.
          </LI>
          <LI>
            Q1 2026 net earned premiums rose to ~$434M from ~$300M a year earlier, with
            underwriting fee income appearing via Apollo.
          </LI>
          <LI>
            The thesis is diversified specialty premium growth plus fee income, with
            underwriting margin as the gatekeeper.
          </LI>
          <LI>
            Acquisition integration, loss inflation, and reinsurance markets are the main
            risks.
          </LI>
        </UL>
      </TLDR>

      <H2>Business overview</H2>
      <P>
        <Strong>Skyward Specialty Insurance Group (SKWD)</Strong> underwrites specialty
        commercial property and casualty risks — the kinds of accounts that need tailored
        forms, higher expertise, or surplus-lines flexibility. Distribution is
        brokerage-driven, and the culture is closer to a collection of underwriting boxes
        than a personal-auto assembly line.
      </P>
      <P>
        The Apollo acquisition expanded Skyward into Lloyd&apos;s platform operations,
        including managed syndicates and managing-agency activities. From Q1 2026, the
        company reports a Skyward Specialty segment (U.S. brand) and an Apollo segment,
        plus corporate. That structure matters: investors can now see U.S. underwriting
        separately from Lloyd&apos;s underwriting and fee income.
      </P>

      <H2>Our buy thesis</H2>
      <P>
        We added Skyward on July 2, 2026. We own it because specialty commercial insurance
        remains one of the better places in P&amp;C to earn underwriting profit when
        leadership stays disciplined.
        Niche books can reprice faster than mass-market personal lines, and skilled
        underwriters can walk away from stupid risk — a cultural advantage that shows up in
        combined ratios over time.
      </P>
      <P>
        Apollo adds geographic and product diversification plus underwriting fee income
        ($10.1 million in Q1 2026) that does not rely solely on taking insurance risk. Net
        earned premiums of $434 million in Q1 (versus $300 million a year earlier) show the
        scale step-up. Gross written premium across both segments exceeded $660 million in
        the quarter.
      </P>
      <P>
        Near term, the stock is an execution story: prove that the combined platform can
        grow profitably without adverse development or cultural dilution. Medium term, it is
        a compounding specialty franchise with more levers than the pre-deal Skyward alone.
      </P>

      <H2>Growth and profitability</H2>
      <P>
        Growth drivers include rate, exposure, new programs, and Apollo contribution.
        Profitability hinges on accident-year loss ratios, prior-year reserve development,
        expense discipline, and reinsurance spend. Net investment income also rose year over
        year in Q1 as the balance sheet grew — a helpful but secondary earnings stream.
      </P>
      <P>
        We care most about whether Skyward Specialty&apos;s U.S. book still underwrites to
        an attractive ex-Apollo combined ratio while Apollo&apos;s returns (underwriting plus
        fees) clear the cost of capital. Segment reporting makes that monitoring easier than
        it was at deal close.
      </P>

      <H2>Valuation and momentum context</H2>
      <P>
        SKWD typically trades as a small/mid-cap specialty insurer — sensitive to combined
        ratio prints and M&amp;A skepticism. The shares can look expensive on trailing
        earnings after a strong specialty cycle and cheap if you believe the Apollo platform
        earns through a softer market. Our stance is process over price: hold while
        underwriting metrics cooperate; reassess quickly if they do not.
      </P>

      <H2>Potential risks</H2>
      <UL>
        <LI>
          <Strong>Reserve development.</Strong> Specialty casualty can surprise years later.
        </LI>
        <LI>
          <Strong>Integration risk.</Strong> Lloyd&apos;s platforms have cultural and
          operational complexity.
        </LI>
        <LI>
          <Strong>Catastrophe and clash risk.</Strong> Property and specialty aggregations
          can produce outsized losses.
        </LI>
        <LI>
          <Strong>Reinsurance pricing.</Strong> Harder reinsurance markets raise net
          volatility or push rate needs higher.
        </LI>
        <LI>
          <Strong>Competition.</Strong> Other specialty and E&amp;S writers can chase the
          same niches when capital is abundant.
        </LI>
      </UL>

      <H2>Concluding summary</H2>
      <P>
        Skyward Specialty is a niche commercial insurer that has widened its aperture through
        Apollo without abandoning the specialty playbook. We hold SKWD for underwriting-led
        compounding across U.S. and Lloyd&apos;s platforms — measured always by the combined
        ratio, not the press release.
      </P>

      <Callout variant="warning" title="Educational disclaimer">
        <P>
          This note explains why SKWD is in the Outpick live portfolio. It is educational
          research, not a recommendation to buy or sell. See the{" "}
          <A href="/dashboard">dashboard</A> for the live book.
        </P>
      </Callout>

      <KeyTakeaway>
        <P>
          Specialty insurance only works with underwriting discipline — Apollo diversifies
          Skyward, but the combined ratio still decides the thesis.
        </P>
      </KeyTakeaway>
    </Prose>
  ),
};

export default insight;
