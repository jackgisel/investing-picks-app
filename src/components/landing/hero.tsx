import Link from "next/link";
import { PRICING, BACKTEST } from "@/lib/constants";
import { CubeGrid } from "./cube-grid";

const AGENT_CODES = ["APEX", "REVI", "AUDIT", "TAPE", "GUARD", "HELM"] as const;

export function Hero() {
  return (
    <section className="relative py-24 sm:py-28 text-center overflow-hidden">
      <CubeGrid />
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
        <div className="flex flex-wrap items-center justify-center gap-2 mb-10 max-w-[540px] mx-auto">
          {AGENT_CODES.map((code) => (
            <span
              key={code}
              className="font-mono text-[10px] tracking-[2px] font-bold text-accent-green bg-accent-green-soft px-2.5 py-1 border border-accent-green/20"
            >
              {code}
            </span>
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
