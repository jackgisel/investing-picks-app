import Link from "next/link";
import { PRICING, BACKTEST } from "@/lib/constants";
import { ShapeField } from "./cube-grid";

const PILLARS = ["VALUE", "CYCLES", "FUNDAMENTALS", "CONVICTION"] as const;

export function Hero() {
  return (
    <section className="relative py-24 sm:py-28 text-center overflow-hidden">
      <ShapeField />
      <div className="container-op relative z-10">
        <p className="font-mono text-[11px] text-accent-green tracking-[3px] mb-6">
          A STOCK RESEARCH TEAM
        </p>
        <h1 className="font-sans text-4xl sm:text-[44px] font-bold leading-[1.15] mb-6 tracking-tight">
          Beyond index funds.
          <br />
          <span className="text-accent-green">Invest with intention.</span>
        </h1>
        <p className="font-sans text-[17px] text-text-muted max-w-[580px] mx-auto mb-8 leading-relaxed">
          We built our model on {BACKTEST.yearsCovered} years of trailing market
          data. In walk-forward testing, {BACKTEST.winnersCircle} picks more than
          doubled while the portfolio compounded at{" "}
          <strong className="text-text">{BACKTEST.cagr} CAGR</strong> — vs{" "}
          <strong className="text-text">{BACKTEST.spyReturn}</strong> for the
          S&amp;P 500. We now trade that research in a live example portfolio.
          You build your own.
        </p>
        <p className="font-mono text-[10px] text-text-dim tracking-[2px] mb-3">
          WHAT WE BELIEVE
        </p>
        <div className="flex flex-wrap items-stretch justify-center gap-1.5 mb-10 max-w-[640px] mx-auto">
          {PILLARS.map((pillar) => (
            <div
              key={pillar}
              className="flex items-center bg-accent-green-soft/40 border border-accent-green/25 px-3 py-2"
            >
              <span className="font-mono text-[10px] tracking-[2px] font-bold text-accent-green leading-none">
                {pillar}
              </span>
            </div>
          ))}
        </div>
        <Link href="/dashboard" className="btn-primary">
          START YOUR MEMBERSHIP
        </Link>
        <p className="mt-4 font-mono text-[12px] text-text-dim tracking-wider">
          Founders: {PRICING.foundersLabel} · then {PRICING.label}
        </p>
      </div>
    </section>
  );
}
