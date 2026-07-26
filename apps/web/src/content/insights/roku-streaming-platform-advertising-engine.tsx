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
    slug: "roku-streaming-platform-advertising-engine",
    title: "Stock buy: Roku’s streaming platform is finally printing real profits",
    description:
      "Roku is the operating system of streaming for millions of households — and platform advertising plus subscriptions are now driving double-digit growth with expanding free cash flow.",
    ticker: "ROKU",
    postType: "pick",
    publishedAt: "2026-05-15",
    readingTime: 8,
    author: "Outpick Research",
    tags: ["streaming", "advertising", "platform"],
  },
  Content: () => (
    <Prose>
      <Lede>
        Roku spent a decade building the rails. The investment case today is simpler: those
        rails monetize through advertising and subscriptions, and the devices business is
        increasingly just the distribution tip of the spear.
      </Lede>

      <TLDR>
        <UL>
          <LI>
            Roku operates a leading TV streaming platform in the U.S., monetized primarily
            through platform advertising and subscriptions, with devices as a secondary line.
          </LI>
          <LI>
            Q1 2026 platform revenue grew ~28% year over year; the company generated solid
            net income, adjusted EBITDA, and continued share repurchases.
          </LI>
          <LI>
            The thesis is durable double-digit platform growth with margin expansion as ads
            and subscriptions scale on a largely fixed software base.
          </LI>
          <LI>
            Ad cycles, competitive OS pressure (Google, Amazon, smart-TV OEMs), and content
            costs can interrupt the story.
          </LI>
          <LI>
            We hold ROKU as a platform compounder exiting its &ldquo;growth at all
            costs&rdquo; era.
          </LI>
        </UL>
      </TLDR>

      <H2>Business overview</H2>
      <P>
        <Strong>Roku (ROKU)</Strong> builds streaming players and, more importantly, the
        software platform that powers Roku OS on dedicated devices and licensed TVs. Users
        watch free ad-supported and paid streaming apps; Roku earns when advertisers buy
        audience, when consumers subscribe through the platform, and — to a lesser extent —
        when hardware ships.
      </P>
      <P>
        Management now breaks Platform into Advertising and Subscriptions for clearer
        reporting. In Q1 2026, advertising and subscriptions were both material contributors
        inside $1.13 billion of platform revenue. The Roku Channel itself remains a major
        engagement surface — a first-party inventory pool that matters for ad yield.
      </P>
      <P>
        Devices revenue is smaller and can be noisy (memory costs, promotions, unit mix). We
        treat hardware primarily as a customer-acquisition and retention tool for the
        higher-margin platform.
      </P>

      <H2>Our buy thesis</H2>
      <P>
        We added Roku on May 15, 2026. We own it because streaming has won living rooms,
        and someone has to own the aggregation layer where apps, ads, and subscriptions meet. Roku&apos;s installed base
        and hours streamed give it a scarce audience graph in a world where linear TV
        advertising keeps shrinking.
      </P>
      <P>
        The financial transition is what made the stock ownable again for a fundamentals-first
        book. Q1 total net revenue was about $1.25 billion (+22% year over year), platform
        revenue +28%, with net income of $86 million and adjusted EBITDA of $148 million
        (+165% year over year). Free cash flow on a trailing basis hit new highs, and the
        company has been buying back stock under an authorized program — a shift from the
        years when dilution and losses dominated the narrative.
      </P>
      <P>
        Full-year commentary has pointed to continued double-digit platform growth and further
        adjusted EBITDA margin expansion. We are underwriting that path: platform scale,
        mid-single-digit opex growth, and devices that do not need to be a profit center to
        justify the franchise.
      </P>

      <H2>Growth and profitability</H2>
      <P>
        Advertising growth tracks streaming hours, ad load, and pricing (CPMs). Subscriptions
        growth tracks attach rates for The Roku Channel Premium and partner offers through
        the platform. Both benefit from engagement; Q1 streaming hours were still up
        year over year even as the category matures.
      </P>
      <P>
        Platform gross margins in the low-to-mid 50s are the economic heart of the company.
        Incremental ad dollars and subscription revenue should continue to drop through at
        attractive rates if content and revenue-share costs stay disciplined. That is the
        operating leverage we care about — not unit sales of players.
      </P>

      <H2>Valuation and momentum context</H2>
      <P>
        ROKU still carries a growth multiple, but it is increasingly an FCF and platform-growth
        debate rather than a faith-based TAM story. Estimate revisions have improved with
        profitability; that can reverse if ad budgets freeze. We prefer owning it while the
        company is still early in proving mid-teens-or-better platform growth can coexist with
        rising cash returns.
      </P>

      <H2>Potential risks</H2>
      <UL>
        <LI>
          <Strong>Advertising recession.</Strong> Platform revenue is still ad-sensitive;
          a sharp cut in brand or performance spend hits fast.
        </LI>
        <LI>
          <Strong>Platform competition.</Strong> Google TV, Fire TV, and OEM smart-TV
          software fight for the same default home screen.
        </LI>
        <LI>
          <Strong>Content and revenue share.</Strong> Rising costs to secure apps or ad
          inventory can pressure platform margins.
        </LI>
        <LI>
          <Strong>Hardware margin noise.</Strong> Component costs (e.g., memory) can swing
          devices profitability and distract the market.
        </LI>
        <LI>
          <Strong>Engagement maturation.</Strong> Hours growth slowing structurally would
          cap ad and subscription upside.
        </LI>
      </UL>

      <H2>Concluding summary</H2>
      <P>
        Roku is the rare consumer-internet platform that already touches tens of millions of
        living rooms and is now converting that reach into advertising, subscriptions, and
        free cash flow. We hold ROKU for that monetization phase — with eyes open to ad-cycle
        and competitive risk.
      </P>

      <Callout variant="warning" title="Educational disclaimer">
        <P>
          This note explains why ROKU is in the Outpick live portfolio. It is educational
          research, not a recommendation to buy or sell. See the{" "}
          <A href="/dashboard">dashboard</A> for the live book.
        </P>
      </Callout>

      <KeyTakeaway>
        <P>
          Underwrite Roku on platform advertising and subscriptions — treat devices as
          distribution, and respect how quickly ad cycles can change the tape.
        </P>
      </KeyTakeaway>
    </Prose>
  ),
};

export default insight;
