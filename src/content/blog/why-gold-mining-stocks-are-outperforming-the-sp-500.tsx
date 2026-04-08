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
    slug: "why-gold-mining-stocks-are-outperforming-the-sp-500",
    title: "Why gold mining stocks are outperforming the S&P 500 in 2026",
    description:
      "Gold mining stocks are outperforming the S&P 500 in 2026 by a wide margin. Here's the margin-expansion math behind it and the names we own to play it.",
    keyword: "gold mining stocks outperforming s&p 500",
    keywords: [
      "gold miners 2026",
      "gold stocks vs sp500",
      "AISC margins",
      "AEM AGI ASA",
      "gold mining basket",
    ],
    publishedAt: "2026-04-07",
    category: "Markets",
    tags: ["gold", "miners", "macro"],
    readingTime: 8,
    author: "Outpick Research",
  },
  Content: () => (
    <Prose>
      <Lede>
        Gold mining stocks outperforming the S&amp;P 500 isn&apos;t a headline anymore &mdash;
        it&apos;s a year-long trend, and the math behind it is more boring (and more durable)
        than most investors think.
      </Lede>

      <TLDR>
        <P>
          Gold has rallied while miners&apos; all-in sustaining costs have stayed roughly flat,
          producing record per-ounce margins. Operating leverage means producer earnings are
          growing two to three times faster than the gold price. Our basket &mdash; AGI, AEM,
          ASA, IAG, ORLA &mdash; reflects that thesis, and a separate &ldquo;real assets&rdquo;
          play in CRS has compounded over 470% since early 2024.
        </P>
      </TLDR>

      <H2>Why miners are beating bullion (and the index)</H2>
      <P>
        Most investors who watch <Strong>gold mining stocks outperforming the S&amp;P 500</Strong>{" "}
        assume the answer is simply &ldquo;gold is up.&rdquo; That&apos;s only half the picture.
        Gold the metal is having a strong year, but a passive bullion ETF doesn&apos;t come close
        to what well-run producers have delivered. The reason is structural: miners are an
        operating business sitting on top of a commodity, and when that commodity moves while
        unit costs stay flat, every incremental dollar of revenue drops almost straight to the
        bottom line.
      </P>
      <P>
        That dynamic has been building for two years. The producers in our book reported
        all-in sustaining costs (AISC) in a band that has barely moved since 2024. Energy is
        well off its 2022 highs, labor has stabilized in most jurisdictions, and the major
        capex bulges from the last build cycle have rolled off. Meanwhile the gold price has
        re-rated. The gap between revenue per ounce and cost per ounce &mdash; the part that
        actually matters for equity holders &mdash; has widened by more than the gold price
        itself has moved.
      </P>

      <H2>The margin-expansion math</H2>
      <P>
        Here is the simple version. Imagine a producer with AISC of $1,400 and a gold price
        of $2,000. Margin per ounce: $600. Now move gold to $2,600 with AISC unchanged. Margin
        per ounce: $1,200. The gold price moved 30%, but per-ounce margin doubled. Earnings
        roughly track that margin line, so earnings growth in this stylized example is closer
        to 100% than 30%.
      </P>
      <P>
        That&apos;s the core of operating leverage in producers, and it&apos;s why a basket of
        miners can outpace bullion in any year where AISC behaves. It&apos;s also why miners
        are punishing on the way down: when the gold price compresses by 20% against flat
        costs, earnings can fall 50%. The leverage runs both directions. We size accordingly,
        and we&apos;d encourage anyone reading this to do the same.
      </P>
      <Callout variant="info" title="Why margin matters more than the gold price">
        <P>
          You can be right on the direction of gold and still pick the wrong miner. Producers
          with creeping AISC, jurisdictional trouble, or capex programs that are still ramping
          will not capture the margin expansion no matter how high bullion goes. Stock selection
          inside the sector matters as much as the sector call itself.
        </P>
      </Callout>

      <H2>Our gold mining positions</H2>
      <P>
        We hold a small basket of producers and a closed-end fund, sized so that no single
        name dominates the portfolio. The point isn&apos;t to bet the farm on bullion &mdash;
        it&apos;s to own a focused, high-quality slice of operating leverage to gold while the
        margin backdrop remains favorable.
      </P>

      <CompareTable
        headers={["Ticker", "Name", "Entry date", "Return", "Outcome"]}
        rows={[
          ["AGI", "Alamos Gold", "2024-08-05", "+174.58%", "Holding"],
          ["AEM", "Agnico Eagle Mines", "2025-01-21", "+139.7%", "Holding"],
          ["ASA", "ASA Gold & Precious Metals", "2025-03-17", "+125.4%", "Holding"],
          ["IAG", "Iamgold", "2025-11-17", "+40.18%", "Holding"],
          ["ORLA", "Orla Mining", "2025-04-07", "+34.77%", "Holding"],
        ]}
      />

      <StatGrid
        stats={[
          { label: "AGI RETURN", value: "+174.58%", green: true },
          { label: "AEM RETURN", value: "+139.7%", green: true },
          { label: "ASA RETURN", value: "+125.4%", green: true },
          { label: "PORTFOLIO ALPHA", value: "+167%", green: true },
        ]}
      />

      <P>
        AGI and AEM are core senior/intermediate producers and reflect the cleanest version of
        the margin-expansion thesis &mdash; high-quality assets in stable jurisdictions, AISC
        in line with guidance, and balance sheets that don&apos;t require capital raises to
        fund growth. ASA is a closed-end vehicle that gives basket exposure with a discount/NAV
        wrinkle that has worked in our favor. IAG and ORLA are smaller operators with more
        idiosyncratic risk; they&apos;re sized smaller for that reason.
      </P>

      <H2>The other &ldquo;metals&rdquo; trade: CRS at +470%</H2>
      <P>
        We want to flag this clearly: <Strong>CRS (Carpenter Technology) is not a gold
        miner</Strong>. It&apos;s a specialty alloys producer serving aerospace and defense
        end markets. We include it here because it shares a thesis with the gold basket
        &mdash; a real-assets, hard-to-replicate, supply-constrained industrial business with
        pricing power &mdash; even though the underlying commodity is completely different.
      </P>
      <P>
        Entered at $68.49 on 2024-01-02, CRS now sits at $390.86, a return of{" "}
        <Strong>+470.68%</Strong> and a profit of more than $22,000 on the position. It is one
        of the eight stocks that more than doubled during our walk-forward backtest window.
        We&apos;re mentioning it in the same article because investors interested in gold
        miners are usually also thinking about real assets and supply-constrained industrials,
        and CRS is the cleanest expression of that adjacent theme in our book.
      </P>

      <H2>How to size a miner basket</H2>
      <P>
        Gold miners are leveraged calls on a volatile commodity. Even with margins working in
        your favor, drawdowns of 30-50% inside a calendar year are normal in this group. The
        single most common mistake we see is putting too much capital into miners after a
        strong run, then getting forced out at the wrong time when the cycle turns.
      </P>
      <UL>
        <LI>Cap total miner exposure at 15-20% of the portfolio at most.</LI>
        <LI>No single miner above 4-5% of the portfolio at cost.</LI>
        <LI>Mix seniors and intermediates; avoid concentrating in juniors.</LI>
        <LI>Pay attention to jurisdiction risk &mdash; mines in unstable regions can lose value overnight regardless of the gold price.</LI>
        <LI>Decide your exit rule before you enter, not after the position has doubled.</LI>
      </UL>

      <P>
        For a longer discussion of how we think about position counts and portfolio construction,
        see our piece on{" "}
        <A href="/blog/how-many-stocks-should-you-hold-to-beat-the-market">
          how many stocks you should hold to beat the market
        </A>
        .
      </P>

      <InlineCTA />

      <H2>Risks and what could break the thesis</H2>
      <P>
        The bear case for miners is straightforward: gold rolls over, AISC creeps up because
        of energy or labor costs, or a specific operator hits a production miss. Any one of
        those things can compress earnings fast, and miner equities will price the bad news in
        days, not quarters. There&apos;s also jurisdiction risk &mdash; mining is still a
        permission-based business, and governments change the rules.
      </P>
      <P>
        For more on how we think about active risk versus passive index exposure, see{" "}
        <A href="/blog/alpha-vs-beta-what-active-stock-picking-actually-buys-you">
          alpha vs beta: what active stock picking actually buys you
        </A>
        . And if you want to see the broader system, our entire approach is documented in{" "}
        <A href="/blog/walk-forward-backtesting-explained">
          walk-forward backtesting explained
        </A>
        .
      </P>

      <Callout variant="warning" title="Educational disclaimer">
        <P>
          These positions are shown for educational and transparency purposes. They are not
          recommendations to buy or sell. Outpick is educational research, not financial advice.
          Past performance is not indicative of future results. Gold mining stocks are volatile,
          cyclical, and can decline 50% or more in short periods. Always size positions according
          to your own risk tolerance and consult a licensed advisor before making investment
          decisions.
        </P>
      </Callout>

      <H2>Frequently asked questions</H2>
      <FAQList
        items={[
          {
            q: "Are gold mining stocks better than buying gold?",
            a: "It depends on what you want exposure to. Bullion gives you a clean, low-volatility track of the metal. Miners give you operating leverage to the metal, which means bigger gains when margins expand and bigger losses when they compress. Most investors who want gold exposure use both: bullion as the stable ballast and a small miner basket as the higher-beta sleeve.",
          },
          {
            q: "Is it too late to buy gold miners in 2026?",
            a: "We can't time markets and we won't pretend to. What we can say is that the margin-expansion math still favors producers as long as AISC stays flat and the gold price holds. The bigger risk is sizing too aggressively after a strong run, not picking the wrong moment to start a position. Cycles in this sector are long but volatile.",
          },
          {
            q: "What's the difference between major and junior gold miners?",
            a: "Majors and intermediates own producing mines with cash flow, balance sheets, and operating histories. Juniors are typically pre-production or single-asset companies whose value depends on a discovery, a financing, or a specific permit. Juniors can return many multiples of capital but also routinely go to zero. Our basket leans heavily toward producers for that reason.",
          },
          {
            q: "How risky are gold mining stocks?",
            a: "Very. Miners are among the more volatile parts of the equity market. A 30-50% intra-year drawdown is normal even in good years. The leverage that makes them attractive on the way up is exactly what makes them painful on the way down. Size accordingly and never let a miner basket dominate a portfolio.",
          },
        ]}
      />

      <KeyTakeaway>
        <P>
          Gold mining stocks are outperforming the S&amp;P 500 because miner margins are
          expanding faster than the gold price itself. The math is simple, the leverage is
          real, and the risk is just as real. Own a small, high-quality basket, size it
          carefully, and don&apos;t confuse a strong cycle for a permanent state of the world.
          You can see our live track record on the{" "}
          <A href="/dashboard">Outpick dashboard</A>.
        </P>
      </KeyTakeaway>
    </Prose>
  ),
};

export default article;
