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
    slug: "argentina-stocks-the-quiet-engine-of-our-best-trades",
    title: "Argentine equities: the quiet engine of our best trades",
    description:
      "Argentine equity ADRs produced four of our best trades in three years. Here's the contrarian thesis, the names, and the lessons on sizing emerging-market trades.",
    keyword: "argentina stocks high growth investing",
    keywords: [
      "argentine ADRs",
      "emerging markets contrarian",
      "YPF TGS BMA IRS",
      "deep value EM",
      "position sizing",
    ],
    publishedAt: "2026-04-07",
    category: "Markets",
    tags: ["argentina", "emerging markets", "contrarian"],
    readingTime: 8,
    author: "Outpick Research",
  },
  Content: () => (
    <Prose>
      <Lede>
        Four of our best long-term trades came from one place most US investors weren&apos;t
        looking at in 2022: distressed Argentine equity ADRs trading at fractions of book value.
      </Lede>

      <TLDR>
        <P>
          Between late 2022 and early 2024 we built positions in YPF, TGS, BMA, and IRS at
          deeply discounted multiples. Three have closed at returns between +160% and +200%,
          and IRS is still running at over +300%. This piece walks through the thesis, the
          trades, and the sizing discipline that mattered more than any individual stock pick.
        </P>
      </TLDR>

      <H2>The 2022-2023 Argentine setup</H2>
      <P>
        If you&apos;re thinking about <Strong>argentina stocks high growth investing</Strong>,
        the right starting point is what the market actually looked like three years ago.
        Argentine ADRs in 2022 traded as if the country had no future. Many large-cap names
        were priced at 40-60% discounts to tangible book value. Inflation was running above
        100% annualized, the official exchange rate was disconnected from the parallel rate
        by a factor of two, and the political consensus was sliding toward a structural reset.
      </P>
      <P>
        We don&apos;t make political predictions, and we want to be careful here: nothing in
        this piece is a forecast about any government, election, or policy outcome. What we
        are willing to say is that <Strong>asset prices were embedding a very dark scenario</Strong>{" "}
        and the operational businesses behind those tickers were still real, still producing
        cash, and still owned by patient public-market shareholders. That gap &mdash; between a
        functioning business and a price implying terminal decline &mdash; is the entire shape
        of a contrarian deep-value setup.
      </P>

      <H2>Four trades, four very different stories</H2>
      <P>
        We didn&apos;t buy a generic Argentina basket. Each name was bought for a specific
        reason, sized for a specific risk, and had a different exit logic. Here&apos;s what
        actually happened on the four trades:
      </P>

      <CompareTable
        headers={["Ticker", "Name", "Entry", "Exit", "Return", "Outcome"]}
        rows={[
          ["YPF", "YPF (oil & gas)", "$15.01 (2023-11-20)", "$45.01 (2025-01-06)", "+199.87%", "Closed"],
          ["TGS", "Transportadora de Gas del Sur", "$10.62 (2023-02-21)", "$30.78 (2026-01-05)", "+189.83%", "Closed"],
          ["BMA", "Banco Macro", "$22.96 (2023-12-04)", "$64.06 (2024-09-16)", "+179.01%", "Closed"],
          ["IRS", "IRSA (real estate)", "$4.13 (2022-12-19)", "—", "+306.42%", "Holding"],
        ]}
      />

      <StatGrid
        stats={[
          { label: "IRS RETURN", value: "+306.42%", green: true },
          { label: "YPF RETURN", value: "+199.87%", green: true },
          { label: "TGS RETURN", value: "+189.83%", green: true },
          { label: "BMA RETURN", value: "+179.01%", green: true },
        ]}
      />

      <P>
        <Strong>YPF</Strong> was an energy and Vaca Muerta thesis. The company had real reserves,
        improving production economics, and a price that implied permanent state interference. We
        held just over a year and exited at roughly triple cost. <Strong>TGS</Strong> was the
        slow-burn version of the same story &mdash; a regulated gas transportation business
        whose tariff path was structurally re-rating. We held that one for nearly three years
        because the cash flow ramp was patient and the tape was choppy.
      </P>
      <P>
        <Strong>BMA</Strong> (Banco Macro) was the cleanest financials trade in the basket: a
        bank trading at a fraction of book, with exposure to the eventual normalization of real
        rates and credit growth. We exited in late 2024 after a sharp re-rating.{" "}
        <Strong>IRS</Strong> (IRSA), our oldest position from December 2022, is still open at
        over 300% on cost &mdash; a real-estate holding company whose net asset value was
        always going to take the longest to be recognized by the market.
      </P>

      <H2>What we got right (and what we got lucky on)</H2>
      <P>
        We got the framework right: deeply discounted, real businesses, in a market the rest
        of the world had given up on. We sized each position so that no single name could blow
        up the portfolio. We were patient with TGS and IRS instead of trading around them, and
        we let BMA and YPF re-rate before exiting.
      </P>
      <P>
        We got lucky on timing and tape. We don&apos;t take credit for catching exact bottoms
        or for any specific political development. The truth is that several of these positions
        sat flat or down for many months before working, and the ones that worked best (IRS,
        TGS) required holding through periods of severe unrealized drawdown. If we&apos;d been
        forced sellers at the wrong moment, the trades would have looked very different.
      </P>

      <Callout variant="info" title="The hardest part wasn't the entry">
        <P>
          The hardest part of this basket wasn&apos;t finding the names &mdash; everyone could
          see the multiples. The hardest part was sitting through the volatility without
          cutting positions, and not adding so much capital that a 30% drawdown became
          intolerable. Behavior, not analysis, was the binding constraint.
        </P>
      </Callout>

      <H2>Position sizing was the real edge</H2>
      <P>
        We never let any single Argentine name exceed roughly 8% of the portfolio at cost,
        and the basket as a whole stayed inside a sensible cap on emerging-market exposure.
        That wasn&apos;t a hedge against being wrong on the thesis &mdash; it was a hedge
        against being right on the thesis but at the wrong moment. EM trades that work
        eventually still need to be survivable in the meantime.
      </P>
      <P>
        This is the part most retail investors get backwards. They find a contrarian idea,
        get convicted, and then size it like a high-confidence trade. The right move is
        almost always the opposite: <Strong>the more contrarian and asymmetric the setup,
        the smaller the initial position</Strong>. You let the thesis prove itself before you
        size up. The trades in this article are not the result of being smarter than other
        investors; they are the result of being able to hold them long enough to be right.
      </P>
      <P>
        We&apos;ve written more about this dynamic in{" "}
        <A href="/blog/how-to-find-10x-stocks-as-a-long-term-investor">
          how to find 10x stocks as a long-term investor
        </A>{" "}
        and in{" "}
        <A href="/blog/small-cap-stocks-that-beat-the-sp-500">
          small cap stocks that beat the S&amp;P 500
        </A>
        . The common thread across all of those pieces is the same: most of a portfolio&apos;s
        long-run alpha comes from a small number of asymmetric trades that you size correctly
        and hold patiently.
      </P>

      <InlineCTA />

      <H2>Risks we underestimated</H2>
      <P>
        We want to be honest about what we didn&apos;t see clearly. Argentine ADRs trade with
        a tracking risk all their own &mdash; the relationship between the ADR price and the
        local share price can break down during periods of capital control, dividend friction,
        or trading halts. We had stretches where the ADRs moved on US trading dynamics that
        had little to do with the underlying companies. We didn&apos;t always anticipate that.
      </P>
      <P>
        The bigger structural risk &mdash; one we always underwrote but want to call out
        plainly &mdash; is sovereign credit. <Strong>Argentina has defaulted nine times in its
        history</Strong>. Currency control regimes have come on and off for decades. Tax law
        for foreign investors changes. None of those risks went away because the trades worked.
        They were the reason the multiples were cheap in the first place, and they will be the
        reason the next investor in this market either makes a great return or loses money.
      </P>
      <UL>
        <LI>Sovereign default risk &mdash; recurring and historically frequent.</LI>
        <LI>Currency reset risk &mdash; can compress USD-denominated returns even when the local business is healthy.</LI>
        <LI>ADR/local tracking risk &mdash; can produce gaps between the security you own and the company you analyzed.</LI>
        <LI>Liquidity risk &mdash; some Argentine ADRs trade thinly enough that exits matter as much as entries.</LI>
        <LI>Headline risk &mdash; politics and policy can move these names 10-20% in a single session.</LI>
      </UL>

      <H2>The lessons for any contrarian trade</H2>
      <P>
        These four trades are historical. They were taken at specific prices, in specific
        macro conditions, with a specific framework. We are not recommending Argentine ADRs
        today, and the entry prices that made the original thesis attractive no longer exist.
        What does generalize is the playbook itself.
      </P>
      <P>
        For a deeper look at how this fits into our overall approach, see{" "}
        <A href="/blog/how-to-outperform-the-sp-500-with-stock-picks">
          how to outperform the S&amp;P 500 with stock picks
        </A>
        . And for the full system, our biweekly research and live track record sit on the{" "}
        <A href="/dashboard">Outpick dashboard</A>.
      </P>

      <Callout variant="warning" title="Educational disclaimer">
        <P>
          These positions are shown for educational and transparency purposes. They are not
          recommendations to buy or sell. Outpick is educational research, not financial
          advice. Past performance is not indicative of future results. Emerging-market and
          single-country equity exposure carries significant risk including currency
          devaluation, capital controls, sovereign default, and political instability. Always
          size positions according to your own risk tolerance and consult a licensed advisor
          before making investment decisions.
        </P>
      </Callout>

      <H2>Frequently asked questions</H2>
      <FAQList
        items={[
          {
            q: "Is Argentina a good place to invest in 2026?",
            a: "We don't make country-level recommendations and we won't pretend to. The setup that made our 2022-2023 entries attractive — deep discounts to book, distressed multiples, no consensus interest — is largely gone after the rally. Whether the next chapter is attractive depends on prices and on macro conditions we can't predict. Treat it like any other EM allocation: small, sized for survival, and only if you understand the specific risks.",
          },
          {
            q: "How risky are Argentine ADRs?",
            a: "Very. You're combining single-country exposure, currency risk, and ADR-specific tracking risk on top of normal equity volatility. Drawdowns of 30-40% are routine. Argentina has defaulted on sovereign debt nine times in its history. None of that means a trade can't work, but it does mean the trade has to be sized small enough that it can fail without breaking the portfolio.",
          },
          {
            q: "What's the difference between investing in Argentine ADRs vs local shares?",
            a: "ADRs (American Depositary Receipts) are USD-denominated securities that trade on US exchanges and represent an interest in the underlying local share. They're easier to buy from a US brokerage but can trade at premiums or discounts to the local share, especially during periods of capital controls. Local shares give cleaner exposure but require a local brokerage relationship and add currency conversion friction. Most non-Argentine retail investors use ADRs for that reason.",
          },
          {
            q: "How much of a portfolio should be in emerging markets?",
            a: "There's no single right answer, but for most long-term investors a 5-15% total EM allocation is a reasonable starting band, with single-country exposure capped well below that. We never let any individual Argentine name exceed roughly 8% of the portfolio at cost, and the country-level exposure was contained inside the broader EM allocation. Sizing for survival is more important than sizing for upside.",
          },
        ]}
      />

      <KeyTakeaway>
        <P>
          Most of a long-term portfolio&apos;s alpha comes from a few asymmetric trades you
          size correctly and hold patiently. Our Argentine basket is one example of that
          pattern in our book. The trades are historical, the entry prices are gone, and the
          risks they always carried haven&apos;t. The lesson is the part that travels: find
          the setup, size it small, hold it through the noise, and let the thesis play out.
        </P>
      </KeyTakeaway>
    </Prose>
  ),
};

export default article;
