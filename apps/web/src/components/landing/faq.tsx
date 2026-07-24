"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

const faqs = [
  {
    q: "Who is Outpick?",
    a: "Outpick is an independent stock research team. We publish a live portfolio, full research notes, and performance data for investors who want to move beyond index funds — with intention, transparency, and a value-based approach grounded in business fundamentals.",
  },
  {
    q: "What is your investment strategy?",
    a: "We practice value-based investing informed by market cycles and financial fundamentals. We look for quality businesses at the right point in the cycle, hold with intention, and manage risk with clear guardrails.",
  },
  {
    q: "Is this financial advice?",
    a: "No. Outpick is an educational publication. We share our own portfolio, research, and analysis. All investment decisions are entirely yours. We are not registered investment advisers, broker-dealers, or financial planners. Past performance does not guarantee future results.",
  },
  {
    q: "What kind of stocks do you pick?",
    a: "Businesses with strong fundamentals, clear competitive advantages, and long-term growth potential — often small-cap and mid-cap names the major indices overlook. Not meme stocks or day trades.",
  },
  {
    q: "How is performance calculated?",
    a: "From actual entry and exit prices, tracked from the date each pick was published. Total return, CAGR, Sharpe, max drawdown, and win/loss rates — no cherry-picking.",
  },
  {
    q: "What is the founders deal?",
    a: "Through Day 150 of our live example portfolio, new members can join at $250/year instead of the standard $1,000/year. After Day 150, standard pricing applies to new memberships.",
  },
  {
    q: "Can I cancel my subscription?",
    a: "Yes. Billed annually through Paddle. Cancel anytime from account settings — no questions, no hassle.",
  },
  {
    q: "Who runs Outpick?",
    a: "An independent research publication operated by individuals — not a registered adviser, broker-dealer, or bank. Our only revenue is membership fees; we don't accept advertising or sponsored content.",
  },
  {
    q: "Do you guarantee returns?",
    a: "No. All investing carries risk, including loss of principal. Our track record is real, but past performance is not indicative of future results.",
  },
];

export function FAQ() {
  const [open, setOpen] = useState<number | null>(null);

  return (
    <section id="faq" className="border-b border-border">
      <div className="container-op py-20 sm:py-24">
        <div className="max-w-[560px] mb-12">
          <p className="section-label">FAQ</p>
          <h2 className="section-title">Straight answers.</h2>
        </div>

        <div className="max-w-[680px] border-t border-border">
          {faqs.map((faq, i) => {
            const panelId = `faq-panel-${i}`;
            const buttonId = `faq-button-${i}`;
            const isOpen = open === i;
            return (
              <div key={faq.q} className="border-b border-border">
                <h3>
                  <button
                    id={buttonId}
                    type="button"
                    aria-expanded={isOpen}
                    aria-controls={panelId}
                    onClick={() => setOpen(isOpen ? null : i)}
                    className="w-full flex items-center justify-between py-5 text-left gap-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text focus-visible:ring-offset-2 rounded-sm"
                  >
                    <span className="font-sans text-[15px] sm:text-[16px] font-semibold tracking-tight">
                      {faq.q}
                    </span>
                    <ChevronDown
                      size={18}
                      className={cn(
                        "text-text-dim shrink-0 transition-transform duration-200",
                        isOpen && "rotate-180",
                      )}
                      aria-hidden
                    />
                  </button>
                </h3>
                <div
                  id={panelId}
                  role="region"
                  aria-labelledby={buttonId}
                  hidden={!isOpen}
                  className={cn(isOpen ? "pb-5" : "hidden")}
                >
                  <p className="font-sans text-[15px] text-text-muted leading-relaxed pr-8">
                    {faq.a}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
