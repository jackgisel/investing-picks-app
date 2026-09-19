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
  CompareTable,
  Quote,
  InlineCTA,
  FAQList,
  TLDR,
} from "@/components/blog/prose";

const article: Article = {
  meta: {
    slug: "when-to-sell-a-stock-thesis-broken",
    title: "When to sell a stock: thesis broken vs a temporary price drop",
    description:
      "Sell when facts invalidate the thesis, not when the quote drops. How to tell a temporary price move from a broken thesis — and the exit rules Outpick uses.",
    keyword: "when to sell a stock",
    keywords: [
      "exit rules",
      "investment thesis",
      "long-term investing",
      "sell discipline",
      "thesis invalidation",
    ],
    publishedAt: "2026-09-19",
    category: "Education",
    tags: ["strategy", "long-term investing", "process"],
    readingTime: 8,
    author: "Outpick Research",
    cover: "/art/covers/when-to-sell-a-stock-thesis-broken.png",
  },
  Content: () => (
    <Prose>
      <Lede>
        Knowing when to sell a stock is not a chart problem. It is a thesis problem. The quote
        is a vote; the thesis is the argument you actually underwrote.
      </Lede>

      <TLDR>
        <P>
          Long-term investors sell when <Strong>facts invalidate the reason they own the
          business</Strong>, not when the tape prints red. A price drop with the thesis intact
          is noise — hold, and add only if sizing still allows it. A drop with a weakening
          thesis deserves a trim and an evidence deadline. A broken thesis is an exit,
          regardless of whether you are up or down. The most dangerous case is the quiet one:
          price up or flat while the facts deteriorate, because nothing is forcing the
          conversation. Outpick writes that invalidation into the original note and publishes
          an exit note when a position closes — including losers. We are a research firm, not
          a signal service.
        </P>
      </TLDR>

      <H2>The quote is not the thesis</H2>
      <P>
        The search &ldquo;when to sell a stock&rdquo; is usually typed after a red print. That
        is backwards. A moving quote tells you something about other people&apos;s positioning,
        liquidity, and mood. Sometimes it also tells you something about the business. Those
        two signals get collapsed because the quote is the only number that updates every
        second, and the business updates on a slower clock — filings, customers, credit,
        competition.
      </P>
      <P>
        If you entered because a story felt exciting, you have nothing to check when the price
        falls. You will invent a new story, or you will sell to stop the discomfort. Either
        way you are trading your nervous system. If you entered with a written thesis — what
        has to be true, what would prove you wrong, over what horizon — the drop becomes a
        question you can actually answer:{" "}
        <Strong>did the facts change, or only the vote?</Strong>
      </P>
      <P>
        We have written about that split in the early life of a live book: separating{" "}
        <A href="/blog/first-100-days-of-a-live-stock-portfolio">
          thesis broken from price noisy
        </A>
        . The same test applies after year one. Time does not turn a quote into a thesis.
      </P>

      <H2>A four-state map, not a percentage rule</H2>
      <P>
        Generic &ldquo;3 reasons to sell&rdquo; lists usually smuggle in a price rule: down
        20%, take the loss; up 50%, take the gain. Those are not investment rules. They are
        ways to make the P&amp;L feel tidy. A long-term book needs a map that can hold four
        different situations without pretending they are the same trade.
      </P>

      <CompareTable
        headers={["Situation", "What changed", "Default action"]}
        rows={[
          [
            "Price down, thesis intact",
            "Quote only — business still matches the underwrite",
            "Hold. Add only if sizing and cash still allow it.",
          ],
          [
            "Price down, thesis weakening",
            "Evidence is slipping, but not yet disproved",
            "Trim. Set a date and a fact that must show up.",
          ],
          [
            "Thesis broken",
            "The reason you own it is gone",
            "Exit fully, regardless of P&L.",
          ],
          [
            "Price up or flat, thesis rotting",
            "Facts worse; the market has not forced the issue",
            "Most dangerous. Shrink or exit before the quote catches up.",
          ],
        ]}
      />

      <P>
        Notice what is missing: a stop-loss percentage, a moving average, an alert. Those
        tools answer &ldquo;when did the chart move.&rdquo; They do not answer &ldquo;is the
        business we underwrote still the business we own.&rdquo;
      </P>

      <H3>Price down, thesis intact</H3>
      <P>
        This is the case that feels like a test and usually is. A quarter misses because of
        weather, a one-off legal reserve, or a cycle the original note already named. Credit
        is still the credit you underwrote. The competitive position has not flipped. You
        would still initiate today at this price, size held constant.
      </P>
      <P>
        The disciplined move is not heroic buying. It is{" "}
        <Strong>not selling for the sake of feeling active</Strong>. Adding is optional and
        constrained: only if the position is still inside your size rules, and only if you
        are adding to the same thesis, not to a new one you wrote after the drop. Averaging
        down is correct when the price improved and the facts did not deteriorate. It is
        expensive when you are negotiating with a company that is no longer the one you
        bought. For how that sits inside a concentrated book, see{" "}
        <A href="/blog/how-many-stocks-should-you-hold-to-beat-the-market">
          how many stocks you should hold
        </A>
        .
      </P>

      <H3>Price down, thesis weakening</H3>
      <P>
        Weakening is the gray band people skip because it does not feel decisive. Churn is
        edging up. Guidance quality is getting vaguer. A customer concentration you tolerated
        is becoming the story. None of that is yet a full invalidation. All of it is a reason
        to stop treating the position as automatically &ldquo;a hold.&rdquo;
      </P>
      <P>
        The useful move is a <Strong>trim plus an evidence deadline</Strong>. Write down the
        fact that would restore the original underwrite, and the date by which it should be
        visible — an earnings print, a filing, a contract, a credit metric. If the date
        arrives and the fact does not, you have converted fog into a broken thesis. If you
        refuse to name the date, you are hoping the quote will make the decision for you.
      </P>

      <H3>Thesis broken — exit regardless of P&amp;L</H3>
      <P>
        Broken means the reason you own the shares is gone. The moat you underwrote was a
        regulation, and the regulation changed. The balance sheet you needed is now the risk.
        The product cycle you were paying for was delayed into a different company. At that
        point the cost basis is a historical curiosity. Selling a loser does not make you
        &ldquo;wrong twice.&rdquo; Holding a thesis that no longer exists is how a small
        mistake becomes a character trait.
      </P>
      <P>
        This is also true when you are <Strong>up</Strong>. A gain does not repair a dead
        argument. &ldquo;I&apos;ll wait to get back to even&rdquo; and &ldquo;I&apos;ll wait
        until it rounds out a nice percentage&rdquo; are the same error with different
        vanity. The exit is about the business, not the souvenir.
      </P>

      <Quote cite="Warren Buffett">
        Should you find yourself in a chronically leaking boat, energy devoted to changing
        vessels is likely to be more productive than energy devoted to patching leaks.
      </Quote>

      <H3>Price up or flat, thesis rotting</H3>
      <P>
        This is the case almost nobody searches for, and the one that does the most damage
        in a long-term book. The tape is calm. The position may even be a winner. Meanwhile
        unit economics are slipping, the capital cycle is turning against you, or management
        is quietly changing the business you thought you owned. Because there is no red
        number, there is no meeting with yourself.
      </P>
      <P>
        Price is a lagging auditor. If you only review names that hurt, you will keep the
        rotting ones until the quote finally agrees — at which point you will sell into the
        recognition, which is the expensive sequence. A biweekly or monthly review that
        starts with <Strong>the original note, not the P&amp;L</Strong> is how you catch this
        before the market does the work for you. That is the same slow cadence we argued for
        in{" "}
        <A href="/blog/how-to-beat-the-sp-500-without-becoming-a-day-trader">
          how to beat the S&amp;P 500 without becoming a day trader
        </A>
        : thirty minutes on theses, not a day on candles.
      </P>

      <Callout variant="warning" title="Do not average down on a broken thesis">
        <P>
          Adding to a falling stock is only correct if the fundamentals are intact and the
          price has improved. If the original thesis is broken, doubling down is just
          doubling the mistake. A 25–30% drawdown on a single name should trigger a fresh
          reading of the note, not an automatic add.
        </P>
      </Callout>

      <H2>What an exit rule actually is</H2>
      <P>
        An exit rule is a sentence you can falsify. It is not a feeling, and it is not a
        chart setup. The useful form is:{" "}
        <Strong>we would be wrong if X is no longer true, evidenced by Y, over horizon
        Z</Strong>
        . X is the economic claim. Y is an observable — a margin, a credit ratio, a customer
        metric, a regulatory outcome. Z is long enough for a business to speak and short
        enough that you cannot hide.
      </P>
      <P>
        That is different from a stop-loss. A stop-loss says: if enough other people sell,
        I will too. Sometimes that coincides with a broken business. Often it coincides with
        a noisy quarter, a sector flush, or a forced seller. Long-term underwriting is the
        decision to live with that noise{" "}
        <Strong>on purpose</Strong>, which only works if you wrote down what noise is
        allowed to look like.
      </P>
      <P>
        Bad quarters are not a broken thesis. We underwrite over years. A business can miss
        a print, sit through a down cycle, and still be the company in the original note.
        The error is treating every ugly month as a verdict, or treating every calm month as
        permission to stop reading. Pre-defined exits belong in the entry, not in the panic.
        That is one of the five boring rules in{" "}
        <A href="/blog/how-to-outperform-the-sp-500-with-stock-picks">
          how to outperform the S&amp;P 500 with stock picks
        </A>
        : you exit when the reason you bought is no longer true.
      </P>

      <H2>How Outpick treats selling</H2>
      <P>
        Most &ldquo;when to sell&rdquo; posts are trying to be a trading desk in essay form.
        We are not. Outpick is a research firm that publishes high-conviction ideas on a
        slow cadence. The sell discipline is part of the research, not a separate product.
      </P>
      <UL>
        <LI>
          <Strong>A full thesis, including how we would be wrong.</Strong> Every initiation
          note should state the economic claim and the facts that would invalidate it. If
          that paragraph is missing, you do not have an exit rule. You have a hope.
        </LI>
        <LI>
          <Strong>Exit notes when a position closes — including losers.</Strong> A closed
          name is not a deleted name. We write why we left. That is the only way a track
          record can be audited as a process instead of a highlight reel. Closed work lives
          on the public{" "}
          <A href="/track-record">track record</A>
          ; the point is the reasoning, not a price alert.
        </LI>
        <LI>
          <Strong>Not a signal service.</Strong> We do not send entry and exit prices as
          trade instructions. We do not publish chart setups, stop levels, or &ldquo;sell
          now&rdquo; pings. Members get the argument. They size and execute for their own
          accounts, on their own timetable.
        </LI>
        <LI>
          <Strong>Years, not weeks.</Strong> The book is built to hold businesses long
          enough for a thesis to play out. A bad quarter is an input. It is not, by itself,
          a broken thesis. Cadence exists so we are not forced to invent a new opinion
          every session — see{" "}
          <A href="/blog/why-we-publish-one-stock-pick-every-two-weeks">
            why we publish one stock pick every two weeks
          </A>
          .
        </LI>
      </UL>
      <P>
        That is also how you should evaluate anyone selling stock research. A written thesis
        per pick, losses shown with the same prominence as wins, and a defined cadence are
        the minimum. We laid that checklist out in{" "}
        <A href="/blog/best-stock-picking-newsletters-for-long-term-investors">
          best stock-picking newsletters for long-term investors
        </A>
        . Without an invalidation sentence, you cannot tell whether a winner was skill or
        luck, or whether a thesis has broken when the facts change.
      </P>

      <Callout variant="info" title="Review the note, not the tape">
        <P>
          When a name goes red — or stays suspiciously green — reread the original claim
          before you reread the chart. Did the business change, or only the quote? Would you
          still initiate today at this price? Is the position sized so a full loss cannot
          force a bad decision elsewhere? Those questions scale. A percentage drop does not.
        </P>
      </Callout>

      <InlineCTA />

      <FAQList
        items={[
          {
            q: "How do you know an investment thesis is broken?",
            a: "When the economic claim you underwrote is no longer true, and you can point to evidence — not when the stock is down. If the moat, the balance sheet, the customer, or the regulation that made the purchase coherent has changed, the thesis is broken. If those are intact and a quarter was ugly, you are probably looking at noise. Write the invalidation in advance so you are not inventing it under stress.",
          },
          {
            q: "Should I sell a stock after a 20% drop?",
            a: "Not because of the 20%. A 20% move is common in a concentrated book and in the index itself. Use the drop as a prompt to reread the thesis. If the facts still match the original note, selling solely because of the print is how you lock in noise. If the facts have deteriorated, the percentage is incidental — you are exiting a broken argument.",
          },
          {
            q: "What is an exit rule for long-term investing?",
            a: "A falsifiable sentence: we would be wrong if X is no longer true, shown by Y, by date Z. That is an exit rule. A stop-loss, a moving average, or a 'sell the bounce' alert is a trading heuristic. Useful for some styles. Not a substitute for underwriting a business you intend to own through more than one earnings print.",
          },
          {
            q: "If a stock is up, can the thesis still be broken?",
            a: "Yes — and that is the most expensive case, because nothing is forcing a review. Price can lag deteriorating unit economics, a worse capital cycle, or a business that is no longer the one you bought. Gains do not repair a dead argument. Review names on the original note, not only on the ones that hurt.",
          },
          {
            q: "Is Outpick financial advice?",
            a: "No. Outpick is educational research, not financial advice; past performance is not indicative of future results. Every reader makes their own decisions about whether and how to act on the research.",
          },
        ]}
      />

      <KeyTakeaway>
        <P>
          Sell when the facts stop matching the thesis you wrote, not when the quote
          flinches. Hold noise. Deadline a weakening case. Exit a broken one even if you are
          ahead. Watch the quiet names whose price has not yet confessed. That is sell
          discipline for a long-term book — research, not a siren.
        </P>
      </KeyTakeaway>
    </Prose>
  ),
};

export default article;
