import { Hero } from "@/components/landing/hero";
import { StatsBar } from "@/components/landing/stats-bar";
import { TrackRecord } from "@/components/landing/track-record";
import { Audience } from "@/components/landing/audience";
import { HowItWorks } from "@/components/landing/how-it-works";
import { Agents } from "@/components/landing/agents";
import { DashboardPreview } from "@/components/landing/dashboard-preview";
import { Pricing } from "@/components/landing/pricing";
import { FAQ } from "@/components/landing/faq";
import { Disclaimer } from "@/components/landing/disclaimer";

export default function HomePage() {
  return (
    <>
      <Hero />
      <StatsBar />
      <TrackRecord />
      <Audience />
      <HowItWorks />
      <Agents />
      <DashboardPreview />
      <Pricing />
      <FAQ />
      <Disclaimer />
    </>
  );
}
