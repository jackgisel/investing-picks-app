import { Hero } from "@/components/landing/hero";
import { MarketNoteBand } from "@/components/landing/market-note-band";
import { LivePicks } from "@/components/landing/live-picks";
import { WhatHow } from "@/components/landing/what-how";
import { SampleResearch } from "@/components/landing/sample-research";
import { Philosophy } from "@/components/landing/philosophy";
import { WhatWeAreNot } from "@/components/landing/what-we-are-not";
import { Pricing } from "@/components/landing/pricing";
import { Disclaimer } from "@/components/landing/disclaimer";

// SampleResearch reads the nominated public samples. Hourly is far more often
// than that nomination changes, and it keeps the homepage static for everyone
// else.
export const revalidate = 3600;

export default function HomePage() {
  return (
    <>
      <Hero />
      {/* The only free thing on the site, directly under the hero rather than
          below the price where it only caught people who had already declined
          to buy. */}
      <MarketNoteBand />
      {/* Live proof before any argument about method. Replaced the simulated
          backtest table that used to sit further down. */}
      <LivePicks />
      <WhatHow />
      {/* Two complete notes, published in the open — the claim in WhatHow that
          we write up every open and every close, made checkable. */}
      <SampleResearch />
      <Philosophy />
      {/* Immediately before pricing on purpose: someone who wants alerts and
          price targets should self-select out here, not after paying. */}
      <WhatWeAreNot />
      <Pricing />
      <Disclaimer />
    </>
  );
}
