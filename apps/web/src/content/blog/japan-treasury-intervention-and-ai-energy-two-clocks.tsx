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
  Callout,
  KeyTakeaway,
  FAQList,
  TLDR,
  InlineCTA,
  Quote,
  StatGrid,
} from "@/components/blog/prose";

const article: Article = {
  meta: {
    slug: "japan-treasury-intervention-and-ai-energy-two-clocks",
    title: "Japan's Treasury dump and AI's power problem: two clocks on the US economy",
    description:
      "America sold euros to buy yen while Japan sold Treasuries to defend its currency — and AI spending is racing a grid that takes eight years to plug in. Here's what the headlines miss.",
    keyword: "Japan Treasury holdings US intervention yen AI data center energy",
    keywords: [
      "Exchange Stabilization Fund",
      "Japan Treasury sales",
      "FIMA repo facility",
      "AI data center power grid",
      "PJM capacity auction",
      "US long-term rates 2007",
    ],
    publishedAt: "2026-08-23",
    category: "Markets",
    tags: ["macro", "treasuries", "japan", "AI", "energy"],
    readingTime: 15,
    author: "Outpick Research",
  },
  Content: () => (
    <Prose>
      <Lede>
        The story that made cable news was friendship. The story that moved bond markets was a
        handwritten to-do list, a pot of Treasury money that does not need Congress, and the
        largest foreign holder of US government debt selling paper into a market already at
        nineteen-year highs. Meanwhile, the sector carrying more than half of recent GDP growth
        is betting on power infrastructure with an eight-year wait list.
      </Lede>

      <TLDR>
        <P>
          On July 31, 2026, the US Treasury intervened in FX markets for the first time since
          1998 — buying Japanese yen by selling euro assets from the Exchange Stabilization
          Fund, without coordinating with Europe beforehand. Japan had just posted the largest
          one-month drop in Treasury holdings on record while defending a yen at forty-year
          lows. Days later, Treasury Secretary Scott Bessent publicly asked the Fed to expand
          the FIMA repo facility — a pawn shop for foreign central banks that lets them raise
          dollars without dumping Treasuries — even though nobody was using it. Separately,
          Big Tech is spending more than $700 billion a year on AI infrastructure while
          interconnection queues stretch past eight years, gas turbines are sold out through
          2028, and Goldman Sachs expects only about half of promised data-center capacity to
          arrive on schedule two years out. Two structural risks, one economy: creditor stress
          on the liability side and delivery risk on the growth side.
        </P>
      </TLDR>

      <H2>The receipt was a doodle</H2>
      <P>
        At 11:33 a.m. on Friday, July 31, a photographer with a long lens captured something
        sitting on the desk of the US Secretary of the Treasury: a handwritten note with one
        line legible from across the room —{" "}
        <Strong>&ldquo;Buy Japanese yen, 5 to 10 billion dollars.&rdquo;</Strong> Hours later,
        for the first time in twenty-eight years, the United States walked into the currency
        market and bought yen. The official receipt was a doodle on a notepad.
      </P>
      <P>
        President Trump, asked aboard Air Force One why America was supporting the yen, offered
        friendship, financial strength, and an aside about Pearl Harbor. Tokyo&apos;s finance
        ministry answered in stiffer language: the operation countered excessive volatility and
        disorderly movements in the yen, taken in coordination with the US Treasury. Translated
        out of Treasury speak, the yen was falling, Japan was hurting, and Washington stepped
        in to make the pain stop.
      </P>
      <P>
        The timing mattered. US thirty-year borrowing costs had just hit their highest level
        since July 2007. And the country America was helping holds more US government debt than
        any other foreign nation on Earth. So the polite question behind the polite answers is
        sharper: <Strong>what was America actually buying?</Strong>
      </P>

      <H2>The Secretary&apos;s piggy bank</H2>
      <P>
        Governments do not wire-transfer yen from a checking account on a Friday afternoon. The
        money came from the <Strong>Exchange Stabilization Fund (ESF)</Strong> — a pool at the
        Treasury the Secretary can spend without asking Congress. He needs the president&apos;s
        signature. That is it. The statute says his decisions are final and, quoting the law
        itself, <Strong>may not be reviewed by another officer or employee of the government</Strong>.
      </P>
      <P>
        The ESF was created to stabilize the exchange value of the dollar. History suggests
        &ldquo;stabilize&rdquo; was never as clearly defined as it should have been. Past
        Secretaries reportedly used it for an Oriental carpet, a forty-two-person trip to
        London, Moscow, and Mexico City with no identifiable official purpose, and whatever else
        the Secretary and president agreed counted as stabilization. Think of it as a discretionary
        FX credit card with no itemized receipt requirement.
      </P>
      <P>
        The detail that changes the story is what was inside the fund. America did not buy those
        yen with dollars. It <Strong>sold euros</Strong> — roughly $13 billion of euro assets
        held in the ESF went out the door. The European Central Bank learned after the trades
        had cleared. Senior European officials told the Financial Times the move broke decades
        of convention and had never happened before. When asked, Treasury said it does not
        coordinate with anyone on how it allocates the fund — true, and also the fiscal equivalent
        of pleading the fifth.
      </P>
      <P>
        One more date on the timeline: on July 23, Treasury published its foreign exchange
        monitoring list — the official watch list for trading partners suspected of currency
        manipulation. Japan was on it. Eight days later, the same building that released the
        report bought Japan&apos;s currency. America broke a twenty-eight-year rule, paid by
        dumping Europe&apos;s currency, told Europe afterward, and did it for a country it had
        just flagged as a currency risk.
      </P>

      <Callout variant="info" title="Why Japan matters to US rates">
        <P>
          Japan is the largest foreign holder of US Treasuries — more than China, more than the
          United Kingdom. When Tokyo defends the yen, it needs dollars. Most of its dollar
          reserves sit in bonds, not cash. Selling Treasuries to buy yen is the natural move.
          And selling Treasuries into a market where long rates are already at multi-decade highs
          is everyone&apos;s problem, not just Japan&apos;s.
        </P>
      </Callout>

      <H2>Japan&apos;s doom loop</H2>
      <P>
        Japan owes more relative to GDP than any major country on Earth. Servicing that debt
        jumped nearly 11% this year to roughly 13 trillion yen against a total budget of 122.3
        trillion. Right as the debt bill spirals, the yen has collapsed toward forty-year lows.
        The mechanism is basic math, not sentiment.
      </P>
      <P>
        For decades Japan pinned borrowing costs near zero. It recently started rolling that
        back. Japan&apos;s benchmark rate now sits around 1% while America&apos;s sits between
        3.5% and 3.75%. Capital does not catch feelings. It goes where it gets paid the most.
        Investors dump yen, chase dollar yield, and the currency falls.
      </P>
      <P>
        Armchair economists ask why Japan does not just raise rates and close the gap. Because
        it cannot — not without detonating the balance sheet it built to survive zero rates.
        To hold borrowing costs at zero for that long, the Bank of Japan bought its own
        government&apos;s bonds until it owned roughly half the entire JGB market. Those bonds
        pay almost nothing because paying nothing was the point. But commercial bank reserves at
        the BOJ earn whatever the policy rate is. Raise rates to save the yen and the central
        bank starts paying out trillions in interest while collecting almost nothing on the
        pile it is stuck holding. Japan can defend the yen or it can afford the debt. Not both.
      </P>

      <H3>The FX intervention feedback loop</H3>
      <P>
        Currencies trade in pairs. To push the yen up, you buy yen and sell the other leg —
        almost always dollars, since the dollar sits on one side of nearly 90% of global FX
        trades. Japan has the dollars. Roughly $1.3 trillion in reserves, with about $930
        billion in securities — mostly US Treasuries. A bond is not money. You cannot hand a
        Treasury note to a currency dealer and ask for change.
      </P>
      <P>
        So Japan has two options: sell bonds or pawn them. It chose to sell. In one month Tokyo
        spent roughly 11.7 trillion yen — nearly $74 billion — on the largest currency defense
        in its history. In May, Japan&apos;s Treasury holdings fell by $66.7 billion, the
        single largest one-month drop by any country in recorded history.
      </P>
      <P>
        It worked for about three weeks. Then the feedback loop kicked in. Bond prices and yields
        move in opposite directions. Flood the market with Treasuries nobody asked for and yields
        rise. Japan sells US debt, American borrowing costs go up, the rate gap widens, and capital
        still flows to the higher yield. Every dollar Tokyo raised to push the yen up made the
        reason the yen was falling slightly worse. That is the FX intervention doom loop — a
        machine that eats its own tail.
      </P>

      <StatGrid
        stats={[
          { label: "JAPAN FX DEFENSE (4 WKS)", value: "~$74B" },
          { label: "MAY TREASURY DROP", value: "$66.7B" },
          { label: "US–JAPAN RATE GAP", value: "250–275 bps" },
          { label: "FIMA REPO BALANCE", value: "$0" },
        ]}
      />

      <H2>The pawn shop nobody was using</H2>
      <P>
        When your largest foreign lender demonstrates in public that it will sell your paper to
        defend its own currency, you build a second way to raise dollars. The Federal Reserve
        operates one: the <Strong>Foreign and International Monetary Authorities (FIMA) repo
        facility</Strong>.
      </P>
      <P>
        Here is how it works. A foreign central bank — say, the Bank of Japan — hands $100 in
        US bonds to the Fed. The Fed gives $100 in cash. The next day the central bank buys the
        bonds back for $101. The $1 spread is the Fed&apos;s interest. The whole point is to
        give foreign countries quick dollar access so they are not forced to dump Treasuries on
        the open market. It is what you build for a creditor you cannot afford to lose.
      </P>
      <P>
        Forty-eight hours after the July 31 joint intervention, Treasury Secretary Scott Bessent
        posted on social media that the FIMA repo facility is an important backstop and that he
        would encourage the Fed to expand it in the coming months. The strange part:{" "}
        <Strong>nobody was using it</Strong>. The facility has a $60 billion per-country ceiling.
        The balance was zero. Bloomberg reported it had gone unused for an eighth straight week.
      </P>
      <P>
        On CNBC, the host laid it out directly: one thing we definitely do not want is Japan
        selling Treasuries to defend the yen. Bessent responded that the goal was to protect the
        US economy and keep volatility offshore, and that the bond market was much smaller when
        FIMA was created in 2020 — so upsizing would be reasonable. He did not mention the
        facility was empty, or that its $60 billion ceiling is less than the $73 billion Japan
        spent in one month alone. You do not publicly ask the central bank to enlarge an unused
        facility unless you expect it to get used.
      </P>
      <P>
        Mark Sobel — who spent roughly four decades inside Treasury on international monetary
        policy — wrote that aside from supporting an ally, Treasury may have been concerned that
        a weak yen could push American long-term rates higher. The president says friendship.
        The finance minister says stability. The career Treasury hand says there is more to the
        story. The public record agrees with the third version.
      </P>

      <H2>The other bet: AI on a grid that moves at Blockbuster speed</H2>
      <P>
        Creditor stress on the liability side of America&apos;s balance sheet is one structural
        risk. Growth concentration on the asset side is another. If Japan&apos;s Treasury sales
        threaten the cost of money, the sector currently carrying the economy threatens the
        return on money.
      </P>
      <P>
        In 2024 the largest tech companies spent a little over $200 billion on AI infrastructure.
        In 2025 that figure approached $400 billion. Their own estimates for 2026 exceed $700
        billion — nearly doubling every year. Deutsche Bank&apos;s George Saravelos wrote to
        clients that AI-related spending appears to be saving the US economy right now; without
        it, the US would be close to or in recession. Last quarter AI accounted for more than
        half of real GDP growth. The concentration is not subtle.
      </P>
      <P>
        Every bubble take you have heard argues the wrong question — whether chatbots work,
        whether AI revolutionizes every industry, whether a model that miscounts letters in
        &ldquo;strawberry&rdquo; can take your job. The real bet is narrower and scarier:{" "}
        <Strong>can the physical infrastructure arrive fast enough to justify what investors
        are paying today?</Strong> Money is disappearing into AI faster than returns are showing
        up. Bubbles do not pop when technology fails. They pop when capital gets tired of
        waiting.
      </P>

      <H3>Clock one: the power clock</H3>
      <P>
        Wall Street loves the Mark Twain advice: do not bet on miners, buy picks and shovels.
        For AI that means data centers, power, transmission. Nobody mentions America is running
        out of picks and shovels.
      </P>
      <P>
        A data center does not plug into the grid and ask nicely. It joins an{" "}
        <Strong>interconnection queue</Strong> — the wait list for grid access. In America&apos;s
        largest power market, that wait stretched from under two years in 2008 to over eight
        years today. Data centers already consume more than 4% of US electricity and are projected
        to reach roughly a fifth of consumption by 2035. They run flat out around the clock, not
        like office towers that sleep on weekends.
      </P>
      <P>
        The workhorse behind much of that buildout is the gas turbine — roughly 40% of US
        electricity, among the most complex machines on Earth, built by only a handful of
        companies. Three manufacturers control over three-quarters of the global market. GE
        Vernova&apos;s order backlog ballooned from roughly 80 GW to 116 GW; its CEO says the
        company will be largely sold out through 2028. In 2024 alone developers ordered nearly
        three times more turbine capacity than every factory on Earth could produce in a year.
        Transformers now take over two and a half years with an estimated 30% supply shortage.
        New transmission lines average six and a half years to complete.
      </P>
      <P>
        Tech moves at Netflix speed. The grid moves at Blockbuster speed. Developers have paid
        $25 million not for a turbine but to reserve a place in line. Others have bolted retired
        jet engines to the ground for makeshift power. Money already ran the experiment of
        throwing cash at the problem. Money lost.
      </P>

      <H3>PJM: when the auction hits the ceiling</H3>
      <P>
        PJM Interconnection serves roughly one in five Americans across thirteen states from
        Chicago to Washington, DC. Its biggest annual event is the capacity auction — a billion-dollar
        pinky promise that power plants will be ready on the worst days of the year. For most of
        this century that insurance was cheap because demand barely grew. In the auction covering
        2024, a promise of power cleared at about $29 per megawatt-day.
      </P>
      <P>
        Then data centers arrived by the dozen — each swallowing as much electricity as a small
        city, demanding power now, guaranteed, forever. The next auction cleared near $270 — an
        more than 830% spike. The regional bill went from $2.2 billion to $14.7 billion. Governors
        leaned on PJM. Federal regulators signed off on a legal ceiling. The next three auctions
        hit that ceiling anyway. What looked like a spike became the floor.
      </P>
      <P>
        In December 2025 something happened that had never happened in PJM&apos;s history: the
        auction came up short. PJM went shopping with more money than ever, paid the maximum
        price allowed under federal law, and still could not buy enough supply to meet its reserve
        margin target. All that money cannot summon a gas turbine, transformer, or transmission
        line out of thin air when manufacturers are booked years out. The bill does not stay with
        Big Tech alone — it flows into household electric rates. Monitoring Analytics found that
        of $16.4 billion in recent auction costs, roughly $6.5 billion — forty cents of every
        capacity dollar — traces directly to data centers.
      </P>

      <H3>Clock two: the chip clock</H3>
      <P>
        Data centers are warehouses for the most expensive product in the buildout: AI chips.
        They have two problems. First, they do not age well. A cutting-edge AI chip stays
        cutting-edge for somewhere between two and six years depending on who you ask. The
        infrastructure serving it lasts decades. Chips age like smartphones; power equipment ages
        like bridges. When chips go obsolete, the grid assets built to feed them stay on utility
        books for decades and a chunk of the cost shifts to ratepayers.
      </P>
      <P>
        Second, reported earnings may depend on a boring accounting guess: how long a server
        stays useful. Stretch the depreciation schedule and annual expenses fall; profits look
        bigger today. Michael Burry argues Big Tech is understating depreciation by roughly $176
        billion between 2026 and 2028 by assuming six-year useful lives when the real number is
        lower. Nvidia pushes back. The tech companies cannot agree with each other: Amazon extended
        server life to six years in January 2024 — cutting depreciation by $3.2 billion and adding
        $2.5 billion to profit — then walked part of it back twelve months later citing the pace
        of AI development. Meta went the opposite direction, extending life to five and a half
        years and adding roughly a dollar to EPS in 2025.
      </P>
      <P>
        Same silicon. Same period. Opposite conclusions. That is the race:
      </P>
      <UL>
        <LI>
          <Strong>Clock one</Strong> — new power infrastructure can take five to ten years to
          build.
        </LI>
        <LI>
          <Strong>Clock two</Strong> — today&apos;s AI chips may only stay economically relevant
          for three to six years.
        </LI>
      </UL>
      <P>
        Goldman Sachs found that historically about 72% of data-center projects due within a year
        opened on schedule. Adjusting for today&apos;s supply chain, they expect about 60% next
        year and 50% two years out — flip a coin. Bloomberg&apos;s energy research ran two
        forecasts side by side: chip sales imply one buildout path; grid capacity implies another.
        By 2033 the gap is 63 GW — roughly half as much power as every operational data center in
        America today, on a grid with an eight-year wait list.
      </P>

      <Quote cite="The uncomfortable summary">
        Success broke the grid. Success kills the chips. The better AI does, the more demand floods
        the grid and the longer clock one takes. The faster AI improves, the quicker hardware goes
        stale and the shorter clock two gets. Success winds both clocks against each other.
      </Quote>

      <H2>Two stories, one surface</H2>
      <P>
        None of this is hidden. It lives in Treasury data releases, FIMA balance sheets, PJM
        auction results, SEC depreciation footnotes, and occasionally a photograph of a notepad
        nobody was supposed to see. The headline story and the story underneath are rarely the
        same one.
      </P>
      <P>
        On the rates side, America intervened to help an ally whose currency defense was
        becoming a Treasury supply problem — while thirty-year yields sat at their highest level
        since 2007 and the FIMA pawn shop sat empty with a capacity smaller than one month of
        Japan&apos;s FX spending. On the growth side, the economy&apos;s current engine is
        capital-intensive infrastructure with a delivery schedule the physical world cannot match
        and an accounting clock that may be shorter than the power clock.
      </P>
      <P>
        For long-term equity investors, the implication is not panic. It is framing. Macro
        context changes which businesses can survive higher rates, which can pass through energy
        costs, and which are priced as if both clocks have already synchronized. Outpick underwrites
        individual companies against that backdrop; we do not trade FX interventions or capacity
        auctions. But ignoring the wiring underneath the headline is how portfolios get surprised
        by things that were public all along.
      </P>

      <Callout variant="warning" title="What this means for investors (and what it does not)">
        <P>
          Elevated long-term rates and foreign creditor selling pressure argue for balance-sheet
          strength, pricing power, and skepticism toward businesses whose returns depend on
          perpetually cheap capital. AI infrastructure concentration argues for distinguishing
          companies that sell shovels with backlogs from companies betting that shovels arrive
          before the chips they are meant to serve go stale. This essay is educational research,
          not a recommendation to buy or sell any security.
        </P>
      </Callout>

      <InlineCTA />

      <H2>Frequently asked questions</H2>
      <FAQList
        items={[
          {
            q: "Why did the US buy yen instead of letting Japan handle it alone?",
            a: "Officially: counter disorderly FX moves and support an ally. Structurally: Japan's defense required selling Treasuries, which pushes US long-term rates higher at a moment they were already at multi-decade highs. The intervention and the FIMA upsizing request both point at protecting the Treasury market, not just the yen.",
          },
          {
            q: "What is the Exchange Stabilization Fund?",
            a: "A Treasury pool the Secretary can deploy for exchange-rate operations with presidential approval and without congressional appropriation. It was funded to stabilize the dollar but has been used broadly over its history. In July 2026 the US sold euro assets from the ESF to buy yen.",
          },
          {
            q: "What is the FIMA repo facility?",
            a: "A Federal Reserve program where foreign central banks temporarily swap US Treasury securities for dollars via repurchase agreements. It lets them raise dollar liquidity without selling bonds into the open market — designed to reduce Treasury supply shocks from FX intervention.",
          },
          {
            q: "Is AI definitely a bubble?",
            a: "This piece does not require a verdict on whether AI works. The delivery risk is separate: spending is doubling annually while grid interconnection waits exceed eight years, turbine manufacturers are sold out for years, and data-center completion rates are falling toward 50%. Bubbles often pop when capital waits longer than expected for physical payoffs, not when the technology fails outright.",
          },
          {
            q: "Why do PJM electricity bills matter for stock investors?",
            a: "Capacity costs flow into regional power prices and household bills, not just hyperscaler P&Ls. They are a visible symptom of grid constraint — the same constraint that determines whether AI capex converts into revenue on schedule. Infrastructure delay is an economy-wide input cost, not a Silicon Valley line item.",
          },
        ]}
      />

      <KeyTakeaway>
        <P>
          America bought yen with Europe&apos;s money while its largest foreign creditor sold
          Treasuries into a nineteen-year-high rate environment — then asked the Fed to expand
          a pawn shop for central banks that nobody was using yet. At the same time, the sector
          carrying GDP growth is racing two clocks: power infrastructure that takes years to build
          and AI hardware that may depreciate faster than the grid can catch up. The receipts are
          public. The headline story is not the whole story. Long-term investors should plan for
          the wiring underneath, not just the cable-news version.
        </P>
      </KeyTakeaway>
    </Prose>
  ),
};

export default article;
