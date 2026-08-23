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
  Callout,
  KeyTakeaway,
  FAQList,
  TLDR,
  InlineCTA,
  Quote,
} from "@/components/blog/prose";

const article: Article = {
  meta: {
    slug: "inflation-is-not-a-five-month-middle-east-story",
    title: "Inflation is not a five-month Middle East story",
    description:
      "Everyone blames Middle East oil for inflation. The Fed’s scoreboard — PCE — has missed 2% for years. Here’s why debt, money supply, and fiscal dominance matter more than the napkin narrative.",
    keyword: "why is inflation still high PCE Fed target",
    keywords: [
      "PCE inflation 2% target",
      "federal debt interest payments",
      "quantitative tightening ended",
      "Sargent Wallace unpleasant monetarist arithmetic",
      "Great Moderation inflation",
    ],
    publishedAt: "2026-07-25",
    category: "Markets",
    tags: ["inflation", "Fed", "fiscal", "macro"],
    readingTime: 11,
    author: "Outpick Research",
    cover: "/art/covers/inflation-is-not-a-five-month-middle-east-story.png",
  },
  Content: () => (
    <Prose>
      <Lede>
        The clean story is that inflation is about the Middle East. War raises energy prices;
        energy raises the CPI print; everyone nods. Napkin economics. The problem is that the
        Federal Reserve does not score the game on that napkin.
      </Lede>

      <TLDR>
        <P>
          The Fed targets roughly <Strong>2% inflation on personal consumption expenditures
          (PCE)</Strong> — not the loudest headline index. As of the latest readings, headline
          PCE is running around <Strong>4%</Strong> and climbing, with core still well above
          target after years of overshoot. A conflict that intensified in early 2026 can
          explain an energy spike. It cannot explain a multi-year miss. The deeper story is
          fiscal: debt near 100% of GDP, net interest near a trillion dollars a year, and a
          monetary policy toolkit that now presses the brake and the accelerator at the same
          time.
        </P>
      </TLDR>

      <H2>The scoreboard that counts</H2>
      <P>
        Markets, mortgages, and savings accounts are priced off what people expect inflation
        and policy rates to be. The Fed&apos;s official longer-run goal is clear: about{" "}
        <Strong>2% measured by the PCE price index</Strong>. That is the number in the
        Monetary Policy Report. That is the number FOMC statements keep referencing. CPI gets
        the cable-news airtime; PCE is the institutional target.
      </P>
      <P>
        Latest data put headline PCE near <Strong>4.1%</Strong> year over year (May 2026), up
        from the mid-2s a year earlier, with core PCE around <Strong>3.4%</Strong>. The Fed
        has raised its own 2026 inflation projections and still sees both measures finishing
        the year well above 2%. Core PCE has now spent <Strong>years</Strong> above target —
        the longest stretch of sustained overshoot in the modern targeting era — not five
        months.
      </P>
      <P>
        So when the narrative says &ldquo;blame the Middle East,&rdquo; ask a simpler
        question: can a shock that began in February explain a problem that was already
        visible on the Fed&apos;s preferred gauge long before that? Energy and geopolitics
        matter. They are an overlay on a structural miss, not the whole diagnosis.
      </P>

      <Callout variant="info" title="Why the Middle East story travels so well">
        <P>
          It has a villain, a mechanism, and a chart that moves the week oil jumps. Multi-year
          fiscal dominance, balance-sheet policy, and sticky services inflation do not fit on
          a napkin. That does not make them less real.
        </P>
      </Callout>

      <H2>Why 2% at all?</H2>
      <P>
        For a number that anchors the financial system, 2% did not fall out of a sacred
        equation. Central banks chose it as a tradeoff: some positive inflation gives policy
        room to cut real rates in a downturn; too much inflation destroys contracting and
        planning. St. Louis Fed economist Christopher Neely has described it plainly as a
        &ldquo;happy medium&rdquo; between the costs of inflation and the benefits of a
        buffer above zero.
      </P>
      <P>
        Zero sounds virtuous until a recession arrives. If inflation is already at zero, short
        rates sit near the floor. The Fed gets one or two cuts and then hits the effective
        lower bound — out of conventional road. Aim at 4% instead and the compounding math
        gets ugly: prices double on a much shorter clock, long-term contracts become guesses,
        and expectations unanchor. Two percent is Goldilocks policy: high enough for a cushion,
        low enough that most Tuesdays you barely notice it —{" "}
        <Strong>if the system can actually deliver it</Strong>.
      </P>

      <H2>The pendulum that was being pushed</H2>
      <P>
        From the mid-1980s through the mid-2000s, U.S. growth was relatively steady and
        inflation relatively tame. Economists called it the{" "}
        <Strong>Great Moderation</Strong>. It felt like an invisible hand. It was not. It was
        a very visible institution repeatedly pushing the inflation pendulum back toward the
        middle — so reliably that a generation forgot someone was standing there.
      </P>
      <P>
        That memory starts with Paul Volcker. Late-1970s inflation peaked above 13%. Volcker
        drove policy rates toward 20%, accepted back-to-back recessions, and crushed the
        inflation psychology of the era. Brutal. Effective. And critically:{" "}
        <Strong>the country could absorb the fiscal damage</Strong>. Federal debt was a
        fraction of GDP by today&apos;s standards. Raising rates mostly did one job — slam the
        brakes — without simultaneously detonating the interest bill on a wartime-sized debt
        stock.
      </P>

      <H2>Why the Volcker replay is harder now</H2>
      <P>
        Debt held by the public is now around <Strong>100% of GDP</Strong> — territory last
        associated with World War II, and projected by the CBO to keep climbing. Net interest
        outlays are on the order of <Strong>$1 trillion a year</Strong>, larger than many
        line items Americans think of as &ldquo;the budget,&rdquo; including defense in recent
        comparisons. Interest has gone from roughly high-single-digit shares of federal
        revenue earlier this decade toward the high teens — a doubling in a handful of years,
        not a rounding error.
      </P>
      <P>
        Raise rates today and you press two pedals at once:
      </P>
      <UL>
        <LI>
          <Strong>The brake.</Strong> Costlier credit, less private borrowing, slower demand.
        </LI>
        <LI>
          <Strong>The accelerator (by accident).</Strong> Higher coupon costs on existing and
          rolling government debt. Those interest dollars do not vanish — they are paid to
          bondholders (pensions, banks, foreign official accounts, households) who then spend,
          reinvest, or roll into the next issue at the new higher rate.
        </LI>
      </UL>
      <P>
        At 25% debt-to-GDP, the second pedal is a footnote. At 100%, both feet are on the
        floor and the wiring between brake and accelerator is the point. That is why
        &ldquo;just do Volcker again&rdquo; is not a strategy memo. It is nostalgia for a
        balance sheet the United States no longer has.
      </P>

      <H3>Sargent and Wallace saw the trap</H3>
      <P>
        In 1981, Thomas Sargent and Neil Wallace published what became known as{" "}
        <Strong>unpleasant monetarist arithmetic</Strong>. The intuition, stripped of journal
        prose: if the fiscal authority never runs primary surpluses, the central bank cannot
        make the real debt disappear. It only chooses the form — bonds today versus money
        tomorrow. Fight inflation hard enough for long enough and you can postpone the
        monetization; you do not repeal the arithmetic.
      </P>
      <P>
        That paper is no longer a dusty seminar curiosity. The fiscal-dominance debate is back
        in mainstream policy conversation precisely because debt service now competes with
        every other national priority. Whether or not any one task force or appointment makes
        the evening news, the constraint is the same:{" "}
        <Strong>monetary tightening without fiscal repair compounds the future money
        problem even as it cools today&apos;s prices</Strong>.
      </P>

      <H2>Headlines lag; money leads</H2>
      <P>
        By the time you feel an earthquake, the fault has already slipped. Inflation prints
        behave the same way. Housing is more than a third of many consumer baskets and resets
        slowly because leases lock. A &ldquo;cooling&rdquo; headline can be measuring rent
        inflation that was set months ago while newer pressures — energy, goods, services —
        are still building.
      </P>
      <P>
        Work backwards. Prices rise when someone can pay the higher price. Paying requires
        money and credit. Broad money (M2) is one crude map of cash within arm&apos;s reach of
        the economy. After 2020 the stock of money went vertical; the subsequent contraction
        under quantitative tightening was historically rare outside depression-era episodes.
        More recently, M2 growth has re-accelerated even as the public argument stayed stuck
        on last month&apos;s gasoline print.
      </P>

      <H2>QE, QT, and the second Fed lever</H2>
      <P>
        Interest rates are the tool everyone argues about. The balance sheet is the tool that
        shows up in emergencies. In the pandemic, quantitative easing pushed the Fed&apos;s
        assets from roughly $4 trillion toward $9 trillion. Inflation followed to a peak above
        9% on CPI in mid-2022. Then the Fed did something it almost never does: ran the
        printer in reverse. Quantitative tightening (QT) began in June 2022. Over the
        following years the Fed allowed more than $2 trillion of securities to roll off —
        draining reserves that the banking system needs to clear every day.
      </P>
      <P>
        You cannot QT forever. Drain past the system&apos;s minimum liquidity line and plumbing
        breaks. The Fed ended QT on <Strong>December 1, 2025</Strong>. Shortly afterward it
        resumed buying securities for reserve-management purposes — on the order of tens of
        billions a month. The balance sheet that took years to shrink started growing again.
        Call it technical, temporary, or whatever the press release prefers. The economic
        meaning is simpler:{" "}
        <Strong>the drain is over; net liquidity is no longer being withdrawn on the prior
        schedule</Strong>.
      </P>

      <H2>Two stories at once</H2>
      <P>
        America is running parallel narratives:
      </P>
      <UL>
        <LI>
          <Strong>The monthly story</Strong> — CPI/PCE prints, oil headlines, &ldquo;cooling&rdquo;
          or &ldquo;hot&rdquo; takes that reset every thirty days.
        </LI>
        <LI>
          <Strong>The structural story</Strong> — CBO deficits near 6% of GDP versus a ~4%
          half-century average, debt closing in on wartime ratios, interest as one of the
          largest budget lines, primary deficits that never quite close.
        </LI>
      </UL>
      <P>
        The first story is what people argue about on social media. The second is what prices
        the path of rates, the dollar, and the equity risk premium over years. For a
        long-term stock picker, confusing the two is expensive. Geopolitical energy shocks
        change near-term inflation prints. They do not rewrite the debt stock.
      </P>

      <Quote cite="Warren Buffett, on fixing deficits">
        Pass a law that says anytime there&apos;s a deficit of more than 3% of GDP, all sitting
        members of Congress are ineligible for re-election. Now you&apos;ve got the incentives
        in the right place.
      </Quote>
      <P>
        Buffett was laughing when he said it. The joke works because the diagnosis is cold:
        both parties campaign on more, not less. Deficits above 3% of GDP have been normal
        for much of the 21st century — not an expensive couple of years. Compound interest on
        that habit is the mechanism. Every year of delay raises the eventual adjustment cost.
      </P>

      <Callout variant="warning" title="What this means for investors (and what it does not)">
        <P>
          Persistent above-target inflation and fiscal dominance risk argue for businesses that
          can pass through costs, hold pricing power, or own real assets — and against
          pretending cash is risk-free in real terms. They do not argue for panic-trading every
          PCE release. Outpick underwrites companies and cycles; macro is context, not a
          day-trading signal. This essay is educational research, not a recommendation to buy
          or sell any security.
        </P>
      </Callout>

      <InlineCTA />

      <H2>Frequently asked questions</H2>
      <FAQList
        items={[
          {
            q: "Is the Middle East irrelevant to inflation?",
            a: "No. Energy shocks move headline inflation and can bleed into expectations. The claim is narrower: a months-old geopolitical story cannot be the full explanation for years of PCE overshoot versus a 2% target.",
          },
          {
            q: "Why care about PCE instead of CPI?",
            a: "Because the Fed says it does. Mortgage and deposit pricing ultimately orbit policy, and policy orbits the Fed’s stated framework. CPI still matters for households and COLAs; PCE is the official scoreboard.",
          },
          {
            q: "Could the Fed still crush inflation like Volcker?",
            a: "In theory, yes — at a fiscal and growth cost that looks different with debt at 100% of GDP and interest already a top budget line. The tradeoff set has changed even if the textbook playbook has not.",
          },
          {
            q: "Does ending QT mean QE is back?",
            a: "Not necessarily in the pandemic sense. Reserve-management purchases can be framed as plumbing. Economically, ending a multi-year drain and restarting purchases still changes the liquidity impulse versus the QT regime.",
          },
        ]}
      />

      <KeyTakeaway>
        <P>
          Stop diagnosing a five-year inflation problem with a five-month war story. The Fed
          targets 2% PCE; the print is still roughly double that and rising. Debt service now
          wires the policy brake to the fiscal accelerator. Until incentives change on the
          deficit, monetary policy is managing symptoms on a balance sheet it no longer fully
          controls — and long-term investors should plan accordingly.
        </P>
      </KeyTakeaway>
    </Prose>
  ),
};

export default article;
