import type { Metadata } from "next";
import Link from "next/link";

import { Prose } from "@/components/blog/prose";
import { MarketNoteSignup } from "@/components/marketing/market-note-signup";
import {
  MARKET_NOTE_SAMPLE_META,
  MarketNoteSample,
} from "@/content/market-note-sample";
import { SITE_NAME } from "@/lib/constants";

export const metadata: Metadata = {
  title: "The Market Note",
  description:
    "A free email every Monday on what our model is scoring across ~3,600 US-listed stocks, which sectors are moving, and how we read the cycle. Read a sample issue.",
  alternates: { canonical: "/market-note" },
};

const WHAT_YOU_GET = [
  {
    title: "What the model is scoring",
    body: "Which sectors are clearing the bar this week across roughly 3,600 US-listed companies, and whether that is businesses improving or prices falling.",
  },
  {
    title: "How we're reading it",
    body: "The cycle context behind the numbers, written the same way we write research: plainly, with the reasoning attached.",
  },
  {
    title: "One idea worth sitting with",
    body: "A single argument or distinction worth carrying into your own investing, whether or not you ever become a member.",
  },
];

/**
 * The free weekly email, with a sample so nobody has to hand over an address to
 * find out what it is.
 *
 * The landing page promotes this directly under the hero, which only works if
 * there is somewhere to send a reader who wants to see the thing before
 * subscribing.
 */
export default function MarketNotePage() {
  return (
    <>
      <div className="container-op border-b border-border py-14 sm:py-16">
        <div className="grid grid-cols-1 items-start gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,460px)] lg:gap-16">
          <div className="max-w-[560px]">
            <p className="section-label section-label-lilac">The Market Note</p>
            <h1 className="section-title">
              Every Monday. Free, always.
            </h1>
            <p className="section-sub">
              What our model is seeing across roughly 3,600 US-listed stocks,
              which sectors are scoring, and how we read the current cycle.
              Market commentary — the picks stay behind the membership.
            </p>
            <p className="font-sans text-[13px] leading-relaxed text-text-dim">
              One click unsubscribes. We never share your address, and{" "}
              {SITE_NAME} sells nothing but memberships.
            </p>
          </div>

          <MarketNoteSignup source="market-note-page" variant="panel" />
        </div>
      </div>

      <section className="border-b border-border">
        <div className="container-op py-14 sm:py-16">
          <div className="grid grid-cols-1 gap-8 sm:grid-cols-3 sm:gap-10">
            {WHAT_YOU_GET.map((item) => (
              <div key={item.title}>
                <h2 className="font-sans text-[16px] font-bold tracking-tight">
                  {item.title}
                </h2>
                <p className="mt-2.5 font-sans text-[14px] leading-relaxed text-text-muted">
                  {item.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-b border-border">
        <div className="container-op py-14 sm:py-16">
          <div className="mx-auto max-w-[760px]">
            <div className="rounded-soft border border-accent-cyan/40 bg-accent-cyan/5 px-5 py-4">
              <p className="font-sans text-[11px] font-bold uppercase tracking-[0.12em] text-text-muted">
                {MARKET_NOTE_SAMPLE_META.issueLabel}
              </p>
              <p className="mt-1.5 font-sans text-[14px] leading-relaxed text-text-muted">
                A representative issue, written to show the format. The figures
                and sectors in it are illustrative — it is not a live market
                call.
              </p>
            </div>

            <header className="mt-8 border-b border-border pb-8">
              <h2 className="font-sans text-[28px] font-bold leading-[1.2] tracking-tight sm:text-[32px]">
                {MARKET_NOTE_SAMPLE_META.title}
              </h2>
              <p className="mt-3 font-mono text-[11px] text-text-dim">
                {MARKET_NOTE_SAMPLE_META.readingTime} min read
              </p>
            </header>

            <Prose>
              <MarketNoteSample />
            </Prose>

            <div className="mt-12 border-t border-border pt-10">
              <MarketNoteSignup source="market-note-sample" variant="panel" />
            </div>

            <p className="mt-8 font-sans text-[14px] leading-relaxed text-text-muted">
              Want the picks themselves?{" "}
              <Link
                href="/pricing"
                className="font-semibold text-text underline underline-offset-4 hover:opacity-70"
              >
                See what membership includes
              </Link>
              , or{" "}
              <Link
                href="/#sample-research"
                className="font-semibold text-text underline underline-offset-4 hover:opacity-70"
              >
                read a full research note
              </Link>{" "}
              first.
            </p>
          </div>
        </div>
      </section>
    </>
  );
}
