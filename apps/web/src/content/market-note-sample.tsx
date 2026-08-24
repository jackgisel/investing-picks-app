import { H2, Lede, LI, P, Strong, UL } from "@/components/blog/prose";

/**
 * A representative issue of the free weekly Market Note.
 *
 * Hand-written and static rather than the last real send. Two reasons: the
 * archive is not public (a specimen has to stay stable so the landing page can
 * link to it forever), and a sample has to demonstrate the FORMAT — what a
 * reader gets every week — rather than whatever last Tuesday happened to be
 * about.
 *
 * It is labeled as a sample on the page. Every figure in it is illustrative and
 * the copy says so; this must never be mistaken for a live market call.
 */
export const MARKET_NOTE_SAMPLE_META = {
  issueLabel: "Sample issue",
  title: "Quality is getting cheaper, and nobody is enjoying it",
  readingTime: 4,
};

export function MarketNoteSample() {
  return (
    <>
      <Lede>
        The screen threw up more names this week than it has in two months, and
        almost all of them came from the same two sectors. That is usually worth
        a sentence of explanation rather than a celebration.
      </Lede>

      <H2>What the model is seeing</H2>
      <P>
        We rescore roughly 3,600 US-listed companies on five factors —
        valuation, growth, profitability, momentum and estimate revisions — each
        measured against the company&apos;s own sector rather than the market as
        a whole. This week the number of names clearing our composite threshold
        rose meaningfully, which happens for one of two reasons: the businesses
        got better, or the prices got worse.
      </P>
      <P>
        It was the prices. Revisions were roughly flat and profitability grades
        barely moved, while valuation grades improved across the board. That is
        a de-rating, not an improvement, and it is a much more interesting
        setup for a buyer than the reverse.
      </P>

      <H2>Where the scoring concentrated</H2>
      <UL>
        <LI>
          <Strong>Industrials.</Strong> The largest cluster of newly qualifying
          names. Margins have held up better than the multiple contraction
          implies, which is the specific gap we look for.
        </LI>
        <LI>
          <Strong>Healthcare equipment.</Strong> Second largest. Estimate
          revisions here are the thing to watch — a cheap name with falling
          estimates is not cheap, it is early.
        </LI>
        <LI>
          <Strong>Software.</Strong> Still scoring poorly on valuation despite a
          rough quarter. Cheaper is not the same as cheap.
        </LI>
      </UL>

      <H2>How we&apos;re reading it</H2>
      <P>
        A broad de-rating in businesses whose fundamentals have not deteriorated
        is the environment a value framework is built for, and also the
        environment in which it feels worst to deploy. Nothing in the process
        changes: the universe gets rescored on the same cadence, one name clears
        the bar, and it gets the same written thesis it would have got in a
        cheerful month.
      </P>
      <P>
        The thing we are watching rather than acting on is the revisions
        picture. Valuation improving while revisions hold is a buying setup.
        Valuation improving <em>because</em> revisions are rolling over is a
        value trap, and the two look identical for about a quarter.
      </P>

      <H2>One idea worth sitting with</H2>
      <P>
        A screen getting more crowded is not a signal to buy more. It is a
        signal that the market has changed its mind about a group of businesses,
        and the useful question is whether it changed its mind for a reason. We
        answer that one name at a time, in writing, and members see the answer.
      </P>
    </>
  );
}
