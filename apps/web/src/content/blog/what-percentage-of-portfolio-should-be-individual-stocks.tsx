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
  CompareTable,
} from "@/components/blog/prose";

const article: Article = {
  meta: {
    slug: "what-percentage-of-portfolio-should-be-individual-stocks",
    title: "What Percentage of Your Portfolio Should Be Individual Stocks?",
    description:
      "How much of your portfolio should be individual stocks? A sizing framework: core vs. satellite, single-stock caps, fund overlap, and when to size up.",
    keyword: "what percentage of portfolio should be individual stocks",
    keywords: [
      "what percentage of portfolio should be individual stocks",
      "individual stocks vs ETFs",
      "core and satellite portfolio",
      "how much to put in individual stocks",
      "single stock position size",
      "stock picking allocation",
    ],
    publishedAt: "2026-10-07",
    category: "Strategy",
    tags: [
      "portfolio construction",
      "position sizing",
      "risk management",
      "stock research",
    ],
    readingTime: 8,
    author: "Outpick Research",
    cover:
      "/art/covers/what-percentage-of-portfolio-should-be-individual-stocks.png",
  },
  Content: () => (
    <Prose>
      <Lede>
        There&apos;s no single correct number. A sensible starting point for
        most self-directed investors is a broad, diversified core (index
        funds or ETFs), with individual stocks as a smaller
        &ldquo;satellite.&rdquo; That satellite is often 5–20% of the total
        portfolio, with no single company above roughly 5% of the total. Go
        above that only if you have a written process, the time to follow
        each company, and a few years of evidence that your picks are worth
        the extra risk.
      </Lede>

      <TLDR>
        <P>
          There&apos;s no single correct number. A sensible starting point
          for most self-directed investors is a broad, diversified core
          (index funds or ETFs), with individual stocks as a smaller
          satellite. That satellite is often 5–20% of the total portfolio,
          with no single company above roughly 5% of the total. Go above
          that only if you have a written process, the time to follow each
          company, and a few years of evidence that your picks are worth the
          extra risk.
        </P>
      </TLDR>

      <P>
        Below is a way to pick <Strong>your</Strong> number instead of
        borrowing a stranger&apos;s.
      </P>

      <H2>What the Reddit threads get right, and what they leave out</H2>
      <P>
        The threads that rank for this question read like polls. Answers run
        from &ldquo;0%, I don&apos;t want single-company risk&rdquo; to
        &ldquo;100% individual stocks,&rdquo; and most land somewhere around
        90/10 or 80/20 in favor of funds. The useful patterns:
      </P>
      <UL>
        <LI>
          <Strong>&ldquo;Fun money&rdquo; sleeves are common.</Strong> Many
          people cap stock picking at around 5–10% so a bad call can&apos;t
          derail retirement.
        </LI>
        <LI>
          <Strong>
            People who started with a big stock-picking slice often shrank
            it.
          </Strong>{" "}
          The usual reason is that beating a broad index over many years
          turned out to be harder, and more time-consuming, than expected.
        </LI>
        <LI>
          <Strong>Some run different accounts differently.</Strong> Index
          funds in retirement accounts, individual stocks in a taxable
          account, or the reverse.
        </LI>
        <LI>
          <Strong>A few use formal bands.</Strong> They set a target
          percentage and rebalance only when it drifts far enough.
        </LI>
      </UL>
      <P>
        What&apos;s missing is the <Strong>why</Strong>. A poll tells you
        what others do, not what fits you. The threads rarely cover how a
        single-stock blowup would hit your whole portfolio, how much you
        already own through your index fund, how many companies you can
        realistically keep up with, or how to decide when you&apos;ve earned
        a bigger slice. That&apos;s what follows.
      </P>

      <H2>Why individual stocks deserve a size limit</H2>
      <P>
        Individual stocks don&apos;t behave like a scaled-down index. Their
        outcomes are lopsided. Research by Hendrik Bessembinder at Arizona
        State found that the majority of stocks, 55.2% of U.S. stocks in a
        1991–2020 global sample, underperformed one-month U.S. Treasury
        bills over the full period. The top-performing 2.4% of firms
        accounted for all of the net global stock market wealth created (
        <A href="https://wpcarey.asu.edu/department-finance/faculty-research/do-stocks-outperform-treasury-bills">
          ASU W. P. Carey summary
        </A>
        ).
      </P>
      <P>
        That cuts both ways. A focused portfolio <Strong>can</Strong> catch
        an exceptional company. It can also miss the few stocks that drive
        the market&apos;s return and end up holding the many that lag. An
        index fund owns the winners automatically. A stock picker has to
        find them. That gap is the risk you&apos;re sizing.
      </P>
      <P>
        FINRA describes concentration risk as &ldquo;the risk of amplified
        losses that may occur from having a large portion of your holdings
        in a particular investment, asset class or market segment&rdquo; (
        <A href="https://www.finra.org/investors/insights/concentration-risk">
          FINRA
        </A>
        ). The individual-stock percentage is mostly a decision about how
        much of that risk you&apos;ll accept on purpose.
      </P>

      <H2>Common reference ranges (conventions, not rules)</H2>
      <CompareTable
        headers={[
          "Your situation",
          "Individual stocks as % of total",
          "Typical single-stock cap",
        ]}
        rows={[
          [
            "No time or interest in researching companies",
            "0%",
            "none",
          ],
          [
            "Curious, learning, want skin in the game",
            "Up to ~5%",
            "Small enough not to matter",
          ],
          [
            "Engaged, with a repeatable research process",
            "~5–20%",
            "~2–5% of total",
          ],
          [
            "Primary strategy, written theses, measured results",
            "20%+",
            "~5–10% of total",
          ],
        ]}
      />
      <P>
        Treat these as starting points. They&apos;re what experienced
        self-directed investors commonly use, not limits from any regulator.
        Your age, income stability, emergency fund, and goals all move the
        numbers.
      </P>

      <H2>The 4-step sizing method</H2>

      <H3>Step 1: Name the purpose of the sleeve</H3>
      <P>Be honest about which of these it is:</P>
      <UL>
        <LI>
          <Strong>Learning or engagement:</Strong> you want to understand
          businesses and stay interested in investing. Keep it small. The
          lesson is the payoff.
        </LI>
        <LI>
          <Strong>Conviction tilt:</Strong> you want to lean toward specific
          companies or themes you&apos;ve researched. Moderate size.
        </LI>
        <LI>
          <Strong>Primary strategy:</Strong> you believe a focused portfolio
          can beat the index after costs and taxes. Only consider this once
          you have evidence, not just belief.
        </LI>
      </UL>
      <P>
        Mixing these up is how a &ldquo;fun&rdquo; 5% turns into 40% after a
        couple of good years.
      </P>

      <H3>Step 2: Run the worst-case test</H3>
      <P>
        Do the arithmetic before you commit. <Strong>Worked example</Strong>,
        with round, hypothetical numbers:
      </P>
      <UL>
        <LI>
          Portfolio: <Strong>$200,000</Strong>
        </LI>
        <LI>
          Individual-stock sleeve: <Strong>15% = $30,000</Strong>, spread
          across <Strong>8 companies</Strong> ={" "}
          <Strong>$3,750 each</Strong> (about <Strong>1.9%</Strong> of the
          total)
        </LI>
      </UL>
      <P>Now stress it:</P>
      <UL>
        <LI>
          <Strong>One company goes to zero:</Strong> the total portfolio
          drops about <Strong>1.9 points</Strong>. That&apos;s painful but
          survivable.
        </LI>
        <LI>
          <Strong>
            The whole sleeve lags the index by 5 points in a year:
          </Strong>{" "}
          the drag on the total is about <Strong>0.15 × 5 = 0.75 points</Strong>
          .
        </LI>
        <LI>
          <Strong>The sleeve beats the index by 5 points:</Strong> the
          total gains about <Strong>0.75 points</Strong>.
        </LI>
      </UL>
      <P>
        That last line is the honest trade-off. A small sleeve keeps
        mistakes small, and it keeps wins small too. To make stock picking
        really matter to your total return, the sleeve has to be bigger, and
        that&apos;s exactly when you need evidence that your picks are
        good. Try your own numbers in the{" "}
        <A href="/tools/concentrated-portfolio-calculator">
          concentrated portfolio calculator
        </A>{" "}
        and the{" "}
        <A href="/tools/downside-risk-worksheet">downside risk worksheet</A>.
      </P>

      <H3>Step 3: Count what you already own through funds</H3>
      <P>
        This is the step most threads skip. If you own a broad U.S. index
        fund, you already own the largest companies, often in meaningful
        amounts. FINRA&apos;s advice is to look &ldquo;under the hood&rdquo;
        of every fund you hold and check how its holdings overlap with
        stocks you own directly (
        <A href="https://www.finra.org/investors/insights/concentration-risk">
          FINRA
        </A>
        ).
      </P>
      <P>
        <Strong>Hypothetical:</Strong> your index fund is 85% of your
        portfolio, and one large company makes up 7% of that fund. You
        already have about <Strong>6%</Strong> of your portfolio in that
        company. Buy another 2% directly and you&apos;re at roughly{" "}
        <Strong>8%</Strong>, well above a 5% single-stock cap, even though
        the direct position looks small. Check your fund&apos;s actual
        holdings page for real weights. For more on this, see{" "}
        <A href="/blog/sp-500-concentration-risk-what-index-investors-miss">
          S&amp;P 500 concentration risk: what index investors miss
        </A>
        .
      </P>

      <H3>Step 4: Earn your way up with evidence</H3>
      <P>
        Start the sleeve at the low end of your range. Then track it
        honestly against a simple alternative, such as the broad index fund
        you&apos;d otherwise hold:
      </P>
      <UL>
        <LI>
          Record every buy and sell,{" "}
          <Strong>including the losers you&apos;ve since sold</Strong>.
        </LI>
        <LI>
          Compare the sleeve&apos;s return after costs with the index over
          the same period.
        </LI>
        <LI>
          Give it a full market cycle, or at least a few years, before
          drawing conclusions. One good year proves very little.
        </LI>
      </UL>
      <P>
        If your picks keep up with or beat the alternative and your process
        is written down, raising the slice is defensible. If they don&apos;t,
        that&apos;s useful information, and the cheapest way to get it was
        with a small sleeve.
      </P>

      <H2>Edge cases the threads raise</H2>
      <P>
        <Strong>
          &ldquo;I&apos;m young. Shouldn&apos;t I take more risk?&rdquo;
        </Strong>{" "}
        A long time horizon lets you take more <Strong>market</Strong>{" "}
        risk, meaning a higher stock-versus-bond allocation. It doesn&apos;t
        automatically justify more <Strong>single-company</Strong> risk.
        Those are different decisions.
      </P>
      <P>
        <Strong>
          &ldquo;What about my employer&apos;s stock?&rdquo;
        </Strong>{" "}
        Treat it as extra concentrated. Your paycheck and your portfolio
        would fall together. FINRA lists company-stock concentration as a
        common source of concentration risk. Many investors keep it well
        below their normal single-stock cap.
      </P>
      <P>
        <Strong>
          &ldquo;A winner grew into 20% of my portfolio.&rdquo;
        </Strong>{" "}
        That&apos;s concentration from performance, not from a decision you
        made. Decide on purpose: trim back to your cap, or write down why
        you&apos;re keeping it bigger. Don&apos;t drift.
      </P>
      <P>
        <Strong>
          &ldquo;Does it matter which account holds the stocks?&rdquo;
        </Strong>{" "}
        It can. Trading individual stocks in a taxable account creates
        taxable events, and in retirement accounts it doesn&apos;t. Account
        rules and taxes vary, so check with a tax professional.
      </P>
      <P>
        <Strong>
          &ldquo;How many stocks should be in the sleeve?&rdquo;
        </Strong>{" "}
        That&apos;s a separate question with its own trade-offs. See{" "}
        <A href="/blog/how-many-stocks-should-you-hold-to-beat-the-market">
          how many stocks you should hold
        </A>
        . The short version: hold only as many as you can actually follow,
        meaning you read the filings and know the thesis for each one.
      </P>

      <H2>Set a rebalancing band so you&apos;re not deciding every week</H2>
      <P>
        Choose a target and a tolerance band. For example, a 15% target with
        a band of one-quarter of the target either way gives you a range of{" "}
        <Strong>11.25%–18.75%</Strong>. Inside the band, do nothing. Above
        it, trim back toward target. Below it, add only if each holding
        still passes your research, never just because the band says buy.
        Rules like this take emotion out of the decision. They also keep a
        hot streak from quietly turning your satellite into your core.
      </P>
      <P>
        Each holding should have a written reason to be there. The{" "}
        <A href="/blog/investment-thesis-template">
          investment thesis template
        </A>{" "}
        is a good starting structure.
      </P>

      <H2>Where Outpick fits</H2>
      <P>
        If you decide individual stocks belong in your satellite, the
        hardest part is the research, not the percentage. Outpick publishes
        one pick every two weeks with a full written thesis, and keeps a
        live example portfolio where losing positions stay visible. That
        makes it a reference for building your own process, not a
        replacement for one. The flat annual price is on the{" "}
        <A href="/pricing">pricing page</A>.
      </P>

      <InlineCTA href="/pricing" />

      <FAQList
        items={[
          {
            q: "Is 10% in individual stocks a good rule of thumb?",
            a: "It's a common starting point, and a reasonable one for many investors who want some exposure without risking their long-term plan. Whether it's right for you depends on your purpose, your worst-case tolerance, and how much time you'll spend on research.",
          },
          {
            q: "How much of my portfolio should be in one stock?",
            a: "Many investors cap any single company at around 5% of their total portfolio, counting what they hold through funds. Some focused investors go up to roughly 10% for a few high-conviction names, but only with a written thesis and active monitoring.",
          },
          {
            q: "Is it better to just own 100% index funds?",
            a: "For many people, yes. It's simple, cheap, and diversified. Owning individual stocks makes sense if you value the learning, have a real research process, and accept that you may trail the index.",
          },
          {
            q: "Should I count my index fund's holdings toward my single-stock limit?",
            a: "Yes. Look-through exposure is real exposure. If a company is a big weight in your index fund, owning it directly as well raises your total stake more than the direct position suggests.",
          },
          {
            q: "When should I increase my individual-stock percentage?",
            a: "After your sleeve has been tracked honestly against a simple index alternative over a meaningful period, including your losers, and your process is written down. Not after one good year.",
          },
          {
            q: "Is this financial advice?",
            a: "No. This article is for education only and isn't personalized financial advice. Your situation, taxes, and risk tolerance are your own. Consider speaking with a licensed professional before making investment decisions. Past performance does not guarantee future results.",
          },
        ]}
      />

      <KeyTakeaway>
        <P>
          The right percentage isn&apos;t about how bullish you feel. It
          comes down to three things: what you can afford to be wrong about,
          how many companies you can genuinely follow, and whether
          you&apos;ve measured your picks against a simple index
          alternative.
        </P>
      </KeyTakeaway>

      <P>
        Outpick is an independent educational publication, not a registered
        investment adviser. Nothing here is a recommendation to buy or sell
        any security.
      </P>
    </Prose>
  ),
};

export default article;
