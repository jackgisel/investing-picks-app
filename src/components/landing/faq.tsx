"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

const faqs = [
  {
    q: "Is this financial advice?",
    a: "No. Outpick is an educational publication. We share our own portfolio, research, and analysis. All investment decisions are entirely yours. We are not registered investment advisers, broker-dealers, or financial planners. Past performance does not guarantee future results. Always consult a qualified financial adviser before making investment decisions.",
  },
  {
    q: "What kind of stocks do you pick?",
    a: "We focus on small-cap and mid-cap high-growth companies often overlooked by major indices. We look for strong fundamentals, clear competitive advantages, and long-term growth potential. These are not meme stocks or day trades — they're positions we plan to hold with conviction.",
  },
  {
    q: "How is performance calculated?",
    a: "All performance data is calculated from actual entry and exit prices, tracked from the date each pick was published. We report total return, CAGR, Sharpe ratio, max drawdown, and win/loss rates. No cherry-picking — you see everything, including the losses.",
  },
  {
    q: "Can I cancel my subscription?",
    a: "Yes. Your subscription is billed annually through Paddle. You can cancel at any time from your account settings. No questions, no hassle.",
  },
  {
    q: "Who runs Outpick?",
    a: "Outpick LLC is a Wyoming limited liability company and an independent research publication focused on long-term equity investing. We are not affiliated with any brokerage, fund, or financial institution. Our only revenue is membership fees — we don't accept advertising or sponsored content.",
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
        <h2 className="section-title">Common questions.</h2>

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
