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
    slug: "asic-ategrity-specialty-insurance-es",
    title: "Stock buy: Ategrity is industrializing E&S underwriting for SMBs",
    description:
      "Ategrity Specialty focuses on excess-and-surplus insurance for small and mid-sized businesses — a tech-enabled underwriting platform with early public-market earnings momentum.",
    ticker: "ASIC",
    postType: "pick",
    publishedAt: "2026-06-18",
    readingTime: 7,
    author: "Outpick Research",
    tags: ["insurance", "E&S", "specialty P&C"],
  },
  Content: () => (
    <Prose>
      <Lede>
        Excess-and-surplus insurance is where standard markets say no. Ategrity&apos;s bet
        is that the SMB slice of that market can be underwritten with production-line speed
        — and still underwrite a profit.
      </Lede>

      <TLDR>
        <UL>
          <LI>
            Ategrity Specialty Insurance Company Holdings (ASIC) is an E&amp;S P&amp;C
            insurer focused on small and medium-sized U.S. businesses.
          </LI>
          <LI>
            Products span general liability, commercial property, management liability, and
            specialty professional lines distributed through brokerage channels.
          </LI>
          <LI>
            Q1 2026 net income rose sharply year over year as the young public company scaled
            premium and underwriting profitability.
          </LI>
          <LI>
            The thesis is tech-enabled &ldquo;productionized&rdquo; underwriting in a large,
            fragmented E&amp;S SMB market.
          </LI>
          <LI>
            Catastrophe loss, pricing competition, and reserving risk are the usual specialty
            insurance ways to lose money.
          </LI>
        </UL>
      </TLDR>

      <H2>Business overview</H2>
      <P>
        <Strong>Ategrity Specialty (ASIC)</Strong> is a specialty property and casualty
        insurance holding company dedicated to the excess and surplus (E&amp;S) market for
        SMBs across the United States. Underwriting runs through Ategrity Specialty Insurance
        Company, a Delaware-domiciled E&amp;S insurer. The company went public in 2025 and
        still carries the footprint of a growth-stage specialty franchise rather than a
        diversified national carrier.
      </P>
      <P>
        Product set includes general liability, commercial property, management liability,
        miscellaneous professional liability, allied healthcare, and architects &amp;
        engineers coverage — sold into retail, real estate, hospitality, and construction
        end markets via brokers and small-business channels. The stated edge is not a unique
        line of business; it is process: data analytics, automation, and what management
        calls productionized underwriting for high volumes of smaller policies.
      </P>

      <H2>Our buy thesis</H2>
      <P>
        We added Ategrity on June 18, 2026. We own ASIC because E&amp;S for SMBs is
        structurally attractive and still fragmented.
        Admitted markets routinely decline or constrain risks that do not fit standard forms;
        surplus lines fill that gap at pricing that can be more responsive to risk. Serving
        that demand with low-touch, high-speed brokerage workflows is a real distribution
        advantage if loss ratios cooperate.
      </P>
      <P>
        Early public financials have been encouraging. In Q1 2026, Ategrity reported net
        income attributable to stockholders of about $25.5 million ($0.51 per diluted share),
        up sharply from the prior-year period, with adjusted earnings essentially in line.
        That kind of step-change so soon after listing is why the name screens as a growth
        specialty rather than a sleepy mutual-style underwriter.
      </P>
      <P>
        Valuation for a young E&amp;S franchise embeds execution: keep growing gross written
        premium without drifting into poorly priced catastrophe or casualty pockets. We are
        underwriting that discipline — and the operating leverage of a digital-first expense
        base — not a one-quarter earnings pop.
      </P>

      <H2>Growth and profitability</H2>
      <P>
        Growth comes from broker appointments, product expansion, and share gains in SMB
        E&amp;S as the platform proves hit ratios and service levels. Profitability comes
        from combined ratio: loss ratio plus expense ratio. Automation should help the
        expense side; the loss side is always the open question in specialty insurance.
      </P>
      <P>
        Investment income will matter more as surplus grows, but the core underwriting result
        is what we watch first. A specialty insurer that grows premium while the combined
        ratio stays comfortably below 100 can compound book value for years; the reverse
        destroys capital quickly.
      </P>

      <H2>Valuation and momentum context</H2>
      <P>
        ASIC trades like a small-cap specialty insurer with growth expectations — often at a
        premium to slower mutual-conversion stories and at a discount to the largest E&amp;S
        platforms. Momentum has followed earnings delivery and the post-IPO seasoning of the
        float. Liquidity is thinner than mega-cap financials; spreads and drawdowns can be
        sharp.
      </P>

      <H2>Potential risks</H2>
      <UL>
        <LI>
          <Strong>Loss inflation and reserving.</Strong> Casualty lines can develop adversely
          years after the premium is earned.
        </LI>
        <LI>
          <Strong>Catastrophe and property aggregations.</Strong> Even SMB books can cluster
          geographically or by peril.
        </LI>
        <LI>
          <Strong>Pricing competition.</Strong> Softening E&amp;S rates would pressure growth
          and margins simultaneously.
        </LI>
        <LI>
          <Strong>Reinsurance cost and availability.</Strong> Treaty pricing affects net
          risk retention and earnings volatility.
        </LI>
        <LI>
          <Strong>Scale and governance.</Strong> As a newer public company, operational and
          control risks remain higher than at multi-decade carriers.
        </LI>
      </UL>

      <H2>Concluding summary</H2>
      <P>
        Ategrity is a focused E&amp;S franchise aiming to industrialize underwriting for the
        SMB segment that standard markets underserve. We hold ASIC for that niche, the early
        evidence of earnings power, and the long runway in specialty surplus lines — while
        treating every combined-ratio print as a fresh test of the thesis.
      </P>

      <Callout variant="warning" title="Educational disclaimer">
        <P>
          This note explains why ASIC is in the Outpick live portfolio. It is educational
          research, not a recommendation to buy or sell. See the{" "}
          <A href="/dashboard">dashboard</A> for the live book.
        </P>
      </Callout>

      <KeyTakeaway>
        <P>
          ASIC is a bet on productionized E&amp;S underwriting for SMBs — own it only as long
          as growth and underwriting margins move together.
        </P>
      </KeyTakeaway>
    </Prose>
  ),
};

export default insight;
