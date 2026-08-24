import Link from "next/link";
import { ArrowRight, X } from "lucide-react";

/**
 * The disqualifier, placed before pricing.
 *
 * A visitor who wants alerts and price targets should discover that here
 * rather than after paying — a refund and a bad review both cost more than a
 * lost signup. Kept to four lines with the detail on its own page, because
 * this section's job is to filter, not to argue.
 */
const NOT = [
  "Publish trading strategies, signals, or how to time an entry",
  "Time the market or call where the index goes next",
  "Publish entry and exit points on a price basis",
  "Send trade alerts you are meant to act on immediately",
  "Give personal advice — we are not a broker or adviser",
];

export function WhatWeAreNot() {
  return (
    <section
      id="what-we-are-not"
      className="relative border-b border-border overflow-hidden"
    >
      <div className="container-op relative py-20 sm:py-24">
        <div className="grid grid-cols-1 lg:grid-cols-2 lg:gap-x-16 gap-y-10 items-start">
          <div className="max-w-[540px]">
            <p className="section-label">
              What we are not
            </p>
            <h2 className="section-title">
              We are a research firm, not a signal service.
            </h2>
            <p className="section-sub mb-0">
              Outpick researches US-listed businesses worth owning for years
              and publishes that research openly. We do not cover trading. That
              rules out most of what people expect from a stock site — worth
              knowing before you join rather than after.
            </p>
          </div>

          <div>
            <ul className="space-y-4">
              {NOT.map((item) => (
                <li key={item} className="flex items-start gap-3.5">
                  <span
                    aria-hidden
                    className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent-red/10"
                  >
                    <X size={12} className="text-accent-red" />
                  </span>
                  <span className="font-sans text-[15px] text-text-muted leading-relaxed">
                    {item}
                  </span>
                </li>
              ))}
            </ul>

            <Link
              href="/what-we-are-not"
              className="mt-8 inline-flex items-center gap-2 font-sans text-[14px] font-semibold text-text underline underline-offset-4 hover:opacity-70 transition-opacity"
            >
              What we do instead
              <ArrowRight size={14} />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
