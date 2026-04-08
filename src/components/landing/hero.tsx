import Link from "next/link";
import { PRICING, BACKTEST } from "@/lib/constants";
import { ShapeField } from "./cube-grid";

const AGENTS = [
  { code: "APEX", role: "Growth Hunter" },
  { code: "REVI", role: "Revisions Reader" },
  { code: "AUDIT", role: "Quality Auditor" },
  { code: "TAPE", role: "Momentum Reader" },
  { code: "GUARD", role: "Risk Officer" },
  { code: "HELM", role: "Portfolio Manager" },
] as const;

export function Hero() {
  return (
    <section className="relative py-24 sm:py-28 text-center overflow-hidden">
      <ShapeField />
      <div className="container-op relative z-10">
        <p className="font-mono text-[11px] text-accent-green tracking-[3px] mb-6">
          AI-DRIVEN EQUITY RESEARCH
        </p>
        <h1 className="font-sans text-4xl sm:text-[44px] font-bold leading-[1.15] mb-6 tracking-tight">
          Six AI agents.
          <br />
          <span className="text-accent-green">Built to beat the S&amp;P.</span>
        </h1>
        <p className="font-sans text-[17px] text-text-muted max-w-[580px] mx-auto mb-8 leading-relaxed">
          A long-term, high-growth stock portfolio managed by six AI agents —
          each with a distinct quantitative research or portfolio management
          personality. Backtest:{" "}
          <strong className="text-text">{BACKTEST.totalReturn}</strong> vs{" "}
          <strong className="text-text">{BACKTEST.spyReturn}</strong> for the
          S&amp;P 500. New picks every two weeks.
        </p>
        <p className="font-mono text-[10px] text-text-dim tracking-[2px] mb-3">
          MEET THE AGENTS
        </p>
        <div className="flex flex-wrap items-stretch justify-center gap-1.5 mb-10 max-w-[640px] mx-auto">
          {AGENTS.map((a) => (
            <div
              key={a.code}
              className="flex flex-col items-center gap-0.5 bg-accent-green-soft/40 border border-accent-green/25 px-3 py-2"
            >
              <span className="font-mono text-[10px] tracking-[2px] font-bold text-accent-green leading-none">
                {a.code}
              </span>
              <span className="font-sans text-[10px] text-text-muted leading-none">
                {a.role}
              </span>
            </div>
          ))}
        </div>
        <Link href="/dashboard" className="btn-primary">
          START YOUR MEMBERSHIP
        </Link>
        <p className="mt-4 font-mono text-[12px] text-text-dim tracking-wider">
          {PRICING.label} — CANCEL ANYTIME
        </p>
      </div>
    </section>
  );
}
