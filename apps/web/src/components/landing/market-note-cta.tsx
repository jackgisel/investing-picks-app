import { MarketNoteSignup } from "@/components/marketing/market-note-signup";

/**
 * Sits directly below Pricing on purpose.
 *
 * A visitor who reaches the price and does not buy is otherwise gone for good.
 * This is the one thing on the site that costs nothing, so it is the only
 * honest thing to offer them next.
 */
export function MarketNoteCta() {
  return (
    <section id="market-note" className="border-b border-border">
      <div className="container-op py-16 sm:py-20">
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,480px)] gap-10 lg:gap-16 items-center">
          <div>
            <p className="section-label section-label-mint">Not ready yet?</p>
            <h2 className="section-title text-[28px] sm:text-[34px] max-w-[440px]">
              Read us for a while first.
            </h2>
            <p className="section-sub mb-0 max-w-[460px]">
              The Market Note is free and always will be. One short read a week
              on what the model is scoring and how we&apos;re reading the cycle.
              No picks — those are what the membership is for — but enough of our
              thinking to judge whether it&apos;s worth paying for.
            </p>
          </div>

          <MarketNoteSignup source="landing-cta" variant="panel" />
        </div>
      </div>
    </section>
  );
}
