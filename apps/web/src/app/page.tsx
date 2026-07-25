import { Hero } from "@/components/landing/hero";
import { StatsBar } from "@/components/landing/stats-bar";
import { TrackRecord } from "@/components/landing/track-record";
import { WhoWeAre } from "@/components/landing/who-we-are";
import { Audience } from "@/components/landing/audience";
import { HowItWorks } from "@/components/landing/how-it-works";
import { Strategy } from "@/components/landing/strategy";
import { DashboardPreview } from "@/components/landing/dashboard-preview";
import { Pricing } from "@/components/landing/pricing";
import { MarketNoteCta } from "@/components/landing/market-note-cta";
import { FAQ } from "@/components/landing/faq";
import { Disclaimer } from "@/components/landing/disclaimer";

export default function HomePage() {
  return (
    <>
      <Hero />
      <StatsBar />
      {/* Proof, then who publishes it. Anyone still reading after the track
          record is asking "who are these people?" — WhoWeAre answers it with
          the record rather than a founder story. */}
      <TrackRecord />
      <WhoWeAre />
      <Audience />
      <HowItWorks />
      <Strategy />
      <DashboardPreview />
      <Pricing />
      {/* Catches the visitor who just decided not to pay today. */}
      <MarketNoteCta />
      <FAQ />
      <Disclaimer />
    </>
  );
}
