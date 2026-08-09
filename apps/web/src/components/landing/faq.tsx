"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { TONE_BG, toneByIndex } from "@/lib/tones";

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
    a: "Through Day 150 of our live example portfolio, eligible new members pay $250 for their first year, then $1,000 per year. The offer can be redeemed once per Outpick account. Applicable taxes are added at checkout.",
  },
  {
    q: "Can I cancel my subscription?",
    a: "Yes. Billing is annual through Stripe. Cancel anytime from account settings; you keep access through the end of your current billing period.",
  },
  {
    q: "Who runs Outpick?",
    a: "Outpick is an independent equity research firm. We publish under the firm's name rather than a founder's, because we'd rather be judged on the record than on a biography — the model, the picks, the live portfolio, and every closed trade are on this site for exactly that reason. We are not a registered adviser, broker-dealer, or bank, and membership fees are our only revenue: no advertising, no sponsored content, no affiliate links.",
  },
  {
    q: "Why should I trust research from a firm that doesn't name its analysts?",
    a: "You shouldn't trust it — you should check it. That's the point of publishing the methodology, the walk-forward validation windows, the full backtest including drawdown and win rate, and every live entry and exit as it happens. A name and a headshot are not evidence. A verifiable record is. If the record stops holding up, you'll see it here before you hear it from us.",
  },
  {
    q: "What is the Market Note?",
    a: "A free weekly email: what the model is scoring across ~3,600 US-listed stocks, which sectors are moving, and how we read the current cycle. It's market commentary, not our picks — published picks and the live portfolio are members-only. One click unsubscribes, and we never share your address.",
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
          <p className="section-label section-label-lilac">FAQ</p>
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
                    <span className="flex items-center gap-3 min-w-0">
                      <span
                        aria-hidden
                        className={`h-2 w-2 rounded-full shrink-0 ${
                          TONE_BG[toneByIndex(i)]
                        }`}
                      />
                      <span className="font-sans text-[15px] sm:text-[16px] font-semibold tracking-tight">
                        {faq.q}
                      </span>
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
