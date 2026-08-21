"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { FOUNDERS_DEAL_ENDS_LABEL } from "@/lib/constants";

const faqs = [
  {
    q: "Who is Outpick?",
    a: "Outpick is an independent research operation built around a team of AI agents that score the market and draft the research. We publish a live example portfolio, full investment theses, and performance data for investors who want to move beyond index funds — with intention, transparency, and a value-based approach grounded in business fundamentals.",
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
    a: "Two ways, kept separate. The live example portfolio marks each pick at the closing price on its entry and exit dates — real trades, on our own capital, with illustrative position sizing so the return reflects price movement, not dollar size. The backtrained model separately reports total return, Sharpe, max drawdown, and win rate over a 3.8-year simulated window, always labeled simulated and never blended with the live numbers.",
  },
  {
    q: "What is the founders deal?",
    a: `Through ${FOUNDERS_DEAL_ENDS_LABEL}, eligible new members pay $250 for their first year, then $1,000 per year. The offer can be redeemed once per Outpick account. Applicable taxes are added at checkout.`,
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
    a: "Our research notes are drafted by a team of AI agents that score roughly 3,600 US-listed stocks every two weeks and write up the one name the framework agrees on, published on a fixed review window. We publish under the firm's name instead of an analyst's for the same reason we tell you that: the record is checkable, a biography isn't. The methodology, the walk-forward validation windows, the full backtrained model including drawdown and win rate, and every live entry and exit are on this site. If the process stops working, you'll see it here before you hear it from us.",
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
                    <span className="flex items-center gap-3 min-w-0">
                      <span
                        aria-hidden
                        className="h-2 w-2 rounded-full shrink-0 bg-border-strong"
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
