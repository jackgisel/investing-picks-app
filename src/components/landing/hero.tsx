import Link from "next/link";
import { PRICING } from "@/lib/constants";
import { CubeGrid } from "./cube-grid";

export function Hero() {
  return (
    <section className="relative py-24 sm:py-28 text-center overflow-hidden">
      <CubeGrid />
      <div className="container-op relative z-10">
        <p className="font-mono text-[11px] text-accent-green tracking-[3px] mb-6">
          LONG-TERM EQUITY RESEARCH
        </p>
        <h1 className="font-sans text-4xl sm:text-[44px] font-bold leading-[1.15] mb-6 tracking-tight">
          Outperform the index.
          <br />
          <span className="text-accent-green">Keep your day job.</span>
        </h1>
        <p className="font-sans text-[17px] text-text-muted max-w-[540px] mx-auto mb-11 leading-relaxed">
          High-growth stock picks researched and tracked for you. New analysis
          every two weeks. Build a portfolio that beats the S&amp;P — without
          becoming a day trader.
        </p>
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
