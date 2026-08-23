import { Hero } from "@/components/landing/hero";
import { WhatHow } from "@/components/landing/what-how";
import { WhoWeAre } from "@/components/landing/who-we-are";
import { Audience } from "@/components/landing/audience";
import { Strategy } from "@/components/landing/strategy";
import { DashboardPreview } from "@/components/landing/dashboard-preview";
import { WhatWeAreNot } from "@/components/landing/what-we-are-not";
import { Pricing } from "@/components/landing/pricing";
import { MarketNoteCta } from "@/components/landing/market-note-cta";
import { FAQ } from "@/components/landing/faq";
import { Disclaimer } from "@/components/landing/disclaimer";

export default function HomePage() {
  return (
    <>
      <Hero />
      {/* What Outpick is and how the loop works. Deep proof (live ledger +
          walk-forward model) lives on /track-record. */}
      <WhatHow />
      <WhoWeAre />
      <Audience />
      <Strategy />
      <DashboardPreview />
      {/* Immediately before pricing on purpose: someone who wants alerts and
          price targets should self-select out here, not after paying. */}
      <WhatWeAreNot />
      <Pricing />
      {/* Catches the visitor who just decided not to pay today. */}
      <MarketNoteCta />
      <FAQ />
      <Disclaimer />
    </>
  );
}
