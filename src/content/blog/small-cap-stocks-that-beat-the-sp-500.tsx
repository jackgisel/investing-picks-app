import type { Article } from "@/lib/blog";
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
  StatGrid,
  CompareTable,
  InlineCTA,
  FAQList,
  TLDR,
} from "@/components/blog/prose";

const article: Article = {
  meta: {
    slug: "small-cap-stocks-that-beat-the-sp-500",
    title: "Small cap stocks that beat the S&P 500 (and how we find them)",
    description:
      "Small cap stocks that beat the S&P 500 aren't rare — they're systematically overlooked. Here's the academic case, three real holdings, and how we screen.",
    keyword: "small cap stocks that beat the S&P 500",
    keywords: [
      "small cap premium",
      "Russell 2000 vs S&P 500",
      "SMB factor",
      "small cap investing strategy",
    ],
    publishedAt: "2026-04-07",
    category: "Research",
    tags: ["small cap", "research", "growth"],
    readingTime: 8,
    author: "Outpick Research",
  },
  Content: () => (
    <Prose>
      <Lede>
        The biggest winners in our portfolio are names most S&amp;P 500 investors have
        never heard of — and that&apos;s precisely the point.
      </Lede>

      <TLDR>
        <P>
          Small cap stocks that beat the S&amp;P 500 exist because the largest
          institutional buyers can&apos;t touch them. Academic research has documented
          the size premium for four decades, and our portfolio currently holds three
          small/mid-cap names up between +174% and +470%. The catch: you have to
          stomach 30%+ drawdowns.
        </P>
      </TLDR>

      <H2>Why small caps beat the S&amp;P 500 over time</H2>
      <P>
        The S&amp;P 500 is a float-weighted index of the 500 largest U.S. companies.
        By definition, it owns more of what has already worked and less of what is
        working right now. A $3B specialty-alloys company compounding earnings at 40%
        a year has roughly zero weight in the index. A $3T software incumbent trading
        at 32x forward earnings has roughly 7%. Over long horizons that math works
        against you.
      </P>
      <P>
        The academic literature has quantified this for decades. Fama and French
        formalized the <Strong>SMB (small-minus-big) factor</Strong> in 1992, showing
        that small-cap stocks historically delivered a premium over large caps after
        controlling for market beta. The Russell 2000 has beaten the S&amp;P 500 in
        most rolling 20-year windows going back to the 1970s, even though the last
        decade has been a large-cap regime driven almost entirely by mega-cap tech.
        Regime changes are the rule, not the exception.
      </P>

      <H2>The institutional blind spot</H2>
      <P>
        Here is the structural edge that doesn&apos;t show up in a textbook. A
        $50 billion hedge fund physically cannot take a meaningful position in a
        $2B market-cap company. If they bought 5% of the float, it would be a
        $100M position — a rounding error for them and an illiquid nightmare to
        exit. So they don&apos;t try.
      </P>
      <P>
        Most large sell-side banks don&apos;t cover these names either. No coverage
        means no earnings-day analyst debates, no price targets, no index inclusion
        pressure. The price discovery is worse, which cuts both ways — but for a
        disciplined long-term buyer, worse price discovery is opportunity. You can
        get great businesses at reasonable multiples because the professional
        money is structurally forbidden from showing up.
      </P>
      <P>
        Individual investors and subscription services like{" "}
        <A href="/">Outpick</A> can buy these names without moving the price. That
        is the entire basis for our small-cap exposure.
      </P>

      <Callout variant="info" title="Why this matters">
        <P>
          The S&amp;P 500 is a great default, not a great ceiling. If you already
          hold an index fund and want to actually beat it, you almost have to go
          where the index can&apos;t — and small caps are the most obvious place.
        </P>
      </Callout>

      <H2>Three small caps from our portfolio</H2>
      <P>
        We&apos;d rather show proof than make claims. Below are three small and
        mid-cap names we currently hold, with real entry dates and returns as of
        April 2026. These are live positions, not cherry-picked backtest lines.
      </P>

      <CompareTable
        headers={["Ticker", "Entered", "Status", "Return"]}
        rows={[
          ["CRS (Carpenter Technology)", "Jan 2024", "Holding", "+470.68%"],
          ["IRS (IRSA Inversiones)", "Dec 2022", "Holding", "+306.42%"],
          ["AGI (Alamos Gold)", "Aug 2024", "Holding", "+174.58%"],
        ]}
      />

      <P>
        <Strong>CRS</Strong> is the clearest example. Carpenter Technology makes
        specialty alloys for aerospace and defense — premium nickel, titanium, and
        stainless products with pricing power few metals companies have. When we
        entered in January 2024, it was a small-cap with almost no mainstream
        attention. Two years later, it&apos;s up nearly 5x on a combination of
        expanding margins, booked aerospace demand, and multiple re-rating.
      </P>
      <P>
        <Strong>IRS</Strong> is an Argentine real estate holding company —
        emerging-market micro-cap, the kind of name most U.S. investors won&apos;t
        even check a quote on. We&apos;ve held it since December 2022 and it is
        up more than 3x. For the broader Argentine macro thesis, see our piece on{" "}
        <A href="/blog/argentina-stocks-the-quiet-engine-of-our-best-trades">
          Argentina as the quiet engine of our best trades
        </A>
        . <Strong>AGI</Strong> is our Alamos Gold position, benefiting from the
        broader precious-metals move covered in{" "}
        <A href="/blog/why-gold-mining-stocks-are-outperforming-the-sp-500">
          why gold mining stocks are outperforming the S&amp;P 500
        </A>
        .
      </P>

      <H2>What we screen for</H2>
      <P>
        Not every small cap is a good buy. Most are small for a reason. Our screen
        is narrow and the bar is high.
      </P>
      <UL>
        <LI>
          <Strong>Sub-$10B market cap</Strong>, with a strong bias toward $1B-$5B
          where coverage is thinnest
        </LI>
        <LI>
          <Strong>Accelerating earnings and expanding margins</Strong> over the
          trailing 4-8 quarters — we want a business that is getting better, not
          just cheaper
        </LI>
        <LI>
          <Strong>Founder-led or owner-operator</Strong> where possible — skin in
          the game changes capital allocation
        </LI>
        <LI>
          <Strong>Identifiable moat</Strong> — niche dominance, regulatory barrier,
          process know-how, or distribution lock-in
        </LI>
        <LI>
          <Strong>Fundamental tailwind</Strong> — a multi-year demand story that
          doesn&apos;t depend on rate cuts or a specific political outcome
        </LI>
        <LI>
          <Strong>Reasonable balance sheet</Strong> — leverage that survives a
          recession, because small caps get punished first when credit tightens
        </LI>
      </UL>

      <StatGrid
        stats={[
          { label: "BACKTEST CAGR", value: "+38.99%", green: true },
          { label: "S&P 500", value: "+83.34%" },
          { label: "ALPHA", value: "+167%", green: true },
          { label: "MAX DRAWDOWN", value: "-27.38%" },
        ]}
      />

      <H2>The volatility tax</H2>
      <P>
        Here is the honest part. Small caps drawdown harder than the index.
        Always. Our own walk-forward backtest from June 2022 to April 2026
        produced a <Strong>-27.38% max drawdown in April 2025</Strong>. Individual
        positions can be worse — 30%, 40%, sometimes more. That volatility is not
        a bug; it is the price of admission for the returns.
      </P>
      <P>
        The investors who fail at small caps fail here. They buy a great business,
        watch it fall 35% in eight weeks, decide the thesis was wrong, and sell at
        the bottom. The investors who succeed accept up front that drawdowns are
        mechanical, not informational. A -30% move in a thinly-traded $2B name
        often tells you nothing about the underlying business — it tells you two
        funds rebalanced in the same week.
      </P>

      <InlineCTA />

      <H2>How to allocate without overdoing it</H2>
      <P>
        We don&apos;t recommend an all-small-cap portfolio. The right structure for
        most long-term investors is a core of index funds plus a satellite sleeve of
        high-conviction picks. The satellite is where the alpha comes from; the
        core keeps you sleeping at night when the satellite is underwater.
      </P>
      <P>
        How much to allocate depends on your risk tolerance and timeline, but 15%
        to 40% of investable assets in an active sleeve is a common institutional
        range. For more on portfolio construction, see{" "}
        <A href="/blog/how-many-stocks-should-you-hold-to-beat-the-market">
          how many stocks you should hold to beat the market
        </A>{" "}
        and{" "}
        <A href="/blog/how-to-beat-the-sp-500-without-becoming-a-day-trader">
          how to beat the S&amp;P 500 without becoming a day trader
        </A>
        .
      </P>
      <P>
        Outpick publishes one pick every two weeks — roughly 26 per year — and we
        hold winners for multi-year periods. You can see the live portfolio and
        track record on the <A href="/dashboard">dashboard</A> or the{" "}
        <A href="/#track-record">public track record</A>.
      </P>

      <FAQList
        items={[
          {
            q: "Are small cap stocks still a good investment in 2026?",
            a: "Historically yes, and the valuation gap between small caps and large caps is near a 20-year wide. The SMB premium is cyclical and the last decade has favored mega-caps, which is exactly the kind of setup that tends to revert. We hold real small-cap positions today because we think the setup is favorable, not in spite of it.",
          },
          {
            q: "How risky are small cap stocks compared to the S&P 500?",
            a: "Measurably riskier on a volatility basis. Small caps typically drawdown 1.5x to 2x what the index does in a bear market. Our own portfolio had a -27.38% max drawdown in April 2025. The right frame isn't avoiding volatility — it's sizing positions so a 30% drop doesn't force you to sell.",
          },
          {
            q: "How much of my portfolio should be in small caps?",
            a: "It depends on your timeline, but 15% to 40% in an active sleeve is a reasonable range for investors with a 10-year+ horizon. Keep the rest in low-cost index funds. The goal is a core-satellite structure, not an all-or-nothing bet.",
          },
          {
            q: "Why don't index funds capture small cap returns?",
            a: (
              <>
                The S&amp;P 500 is large-cap by definition and Russell 2000 ETFs
                own the whole universe including the broken businesses. An actively
                screened small-cap strategy can own only the best ~20-30 names,
                which historically produces very different results. See{" "}
                <A href="/blog/how-to-outperform-the-sp-500-with-stock-picks">
                  how to outperform the S&amp;P 500 with stock picks
                </A>{" "}
                for the broader argument.
              </>
            ),
          },
        ]}
      />

      <KeyTakeaway>
        <P>
          Small cap stocks that beat the S&amp;P 500 exist because the biggest
          buyers in the world are structurally forbidden from owning them. If you
          can tolerate the drawdowns, you get access to a return stream the index
          can&apos;t replicate. Outpick is educational research, not financial
          advice; past performance is not indicative of future results.
        </P>
      </KeyTakeaway>
    </Prose>
  ),
};

export default article;
