import Link from "next/link";
import { Check } from "lucide-react";
import { MarketNoteSignup } from "@/components/marketing/market-note-signup";

/** What is actually in an issue. Kept in sync with /market-note's longer list. */
const IN_EVERY_ISSUE = [
  "Which sectors are clearing the bar",
  "Whether that is businesses improving or prices falling",
  "How we read the cycle behind the numbers",
  "One idea worth sitting with",
];

/**
 * The free weekly email, directly under the hero.
 *
 * It used to sit in position nine of eleven, below the price — a placement that
 * only caught someone who had already decided not to buy. It is the only free
 * thing on the site and the cheapest way for a stranger to judge whether the
 * thinking is worth paying for, so it belongs where people still are.
 *
 * Keeps `id="market-note"` because the footer and older links point at it.
 */

export function MarketNoteBand() {
  return (
    <section
      id="market-note"
      /*
       * `relative` is load-bearing, not cosmetic. The hero's art is an absolute
       * child of a positioned section, so it paints above the static content of
       * every later sibling — this copy rendered *behind* the moon. Positioning
       * this section puts it back on top, and the opaque background finishes
       * the bleed the hero's own bottom gradient starts.
       */
      className="relative z-10 border-b border-border bg-bg-secondary"
    >
      <div className="container-op py-12 sm:py-14">
        <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,420px)] lg:gap-16">
          <div className="max-w-[560px]">
            <p className="section-label section-label-lilac">
              The Market Note · free
            </p>
            <h2 className="font-sans text-[24px] font-bold leading-snug tracking-tight sm:text-[28px]">
              Every Monday, what the model is seeing.
            </h2>
            <p className="mt-3 font-sans text-[15px] leading-relaxed text-text-muted">
              One short read to start the week — roughly four minutes, written
              the same way we write research.
            </p>

            {/* The band used to be a headline and an input, which read as a
                newsletter box rather than a thing worth reading. Say what is
                actually in it. */}
            <ul className="mt-5 grid gap-2.5 sm:grid-cols-2 sm:gap-x-8">
              {IN_EVERY_ISSUE.map((item) => (
                <li
                  key={item}
                  className="flex items-start gap-2.5 font-sans text-[14px] leading-relaxed text-text-muted"
                >
                  <Check
                    size={14}
                    className="mt-[3px] shrink-0 text-accent-green"
                    aria-hidden
                  />
                  {item}
                </li>
              ))}
            </ul>
          </div>

          <div className="w-full">
            <MarketNoteSignup source="landing-hero" variant="inline" />
            <p className="mt-3 font-sans text-[13px] leading-relaxed text-text-dim">
              No picks — those are the membership. One click unsubscribes, and
              we never share your address.{" "}
              <Link
                href="/market-note"
                className="font-semibold text-text underline underline-offset-4 hover:opacity-70"
              >
                Read a sample issue
              </Link>
              .
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
