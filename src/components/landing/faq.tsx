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
    a: "We practice value-based investing informed by market cycles and financial fundamentals — inspired by the discipline of Warren Buffett, the rigor of firms like Jane Street, and the conviction sizing of top venture investors. We look for quality businesses at the right point in the cycle, hold with intention, and manage risk with clear guardrails.",
  },
  {
    q: "Is this financial advice?",
    a: "No. Outpick is an educational publication. We share our own portfolio, research, and analysis. All investment decisions are entirely yours. We are not registered investment advisers, broker-dealers, or financial planners. Past performance does not guarantee future results. Always consult a qualified financial adviser before making investment decisions.",
  },
  {
    q: "What kind of stocks do you pick?",
    a: "We focus on businesses with strong fundamentals, clear competitive advantages, and long-term growth potential — often in small-cap and mid-cap names the major indices overlook. These are not meme stocks or day trades. They're positions we research deeply and plan to hold with conviction.",
  },
  {
    q: "How is performance calculated?",
    a: "All performance data is calculated from actual entry and exit prices, tracked from the date each pick was published. We report total return, CAGR, Sharpe ratio, max drawdown, and win/loss rates. No cherry-picking — you see everything, including the losses.",
  },
  {
    q: "What is the founders deal?",
    a: "Through Day 150 of our live example portfolio, new members can join at $250/year instead of the standard $1,000/year. It's our way of rewarding early believers while the live track record is still building. After Day 150, standard pricing applies to new memberships.",
  },
  {
    q: "Can I cancel my subscription?",
    a: "Yes. Your subscription is billed annually through Paddle. You can cancel at any time from your account settings. No questions, no hassle.",
  },
  {
    q: "Who runs Outpick?",
    a: "Outpick is an independent research publication operated by individuals — not a registered investment adviser, broker-dealer, or financial institution. We are not affiliated with any brokerage, fund, or bank. Our only revenue is membership fees; we don't accept advertising or sponsored content.",
  },
  {
    q: "Do you guarantee returns?",
    a: "No. No one can guarantee investment returns. We share our research and our portfolio transparently, but all investing carries risk, including the loss of principal. Our track record is real, but past performance is not indicative of future results.",
  },
];

export function FAQ() {
  const [open, setOpen] = useState<number | null>(null);

  return (
    <section id="faq" className="border-b border-border">
      <div className="container-op py-20">
        <p className="section-label">FAQ</p>
        <h2 className="section-title">Straight answers.</h2>

        <div className="max-w-[680px]">
          {faqs.map((faq, i) => (
            <div key={i} className="border-b border-border">
              <button
                onClick={() => setOpen(open === i ? null : i)}
                className="w-full flex items-center justify-between py-6 text-left group"
              >
                <span className="font-sans text-[15px] font-semibold group-hover:text-accent-green transition-colors">
                  {faq.q}
                </span>
                <ChevronDown
                  size={16}
                  className={cn(
                    "text-text-dim shrink-0 ml-4 transition-transform duration-200",
                    open === i && "rotate-180"
                  )}
                />
              </button>
              <div
                className={cn(
                  "overflow-hidden transition-all duration-300",
                  open === i ? "max-h-96 pb-6" : "max-h-0"
                )}
              >
                <p className="font-sans text-[13px] text-text-muted leading-relaxed">
                  {faq.a}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
