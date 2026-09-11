import type { Metadata } from "next";
import Link from "next/link";
import { TrackRecord } from "@/components/landing/track-record";
import { PillButton } from "@/components/ui/pill-button";
import { BACKTEST } from "@/lib/constants";
import { DATAFAST_CHECKOUT_GOAL } from "@/lib/datafast";
import { getPublicStrategy } from "@/lib/public-strategy";

export const metadata: Metadata = {
  // The root layout sets a site-wide canonical and Next merges rather
  // than replaces it, so every page that omits this declares the homepage
  // as its canonical URL.
  alternates: { canonical: "/track-record" },
  title: "Track record",
  description: `Live example portfolio and ${BACKTEST.yearsCovered}-year walk-forward backtrained model — wins, losses, and performance vs the S&P 500, published in full.`,
};

export const revalidate = 300;

/**
 * Deep dive for visitors who want the numbers: live book + walk-forward model.
 * Homepage post-hero covers What/How; this page owns the proof sheets.
 */
export default async function TrackRecordPage() {
  const strategy = await getPublicStrategy();

  return (
    <>
      <div className="container-op border-b border-border py-14 sm:py-16">
        <div className="max-w-[640px]">
          <p className="section-label">Track record</p>
          <h1 className="section-title">
            The live book and the model behind it.
          </h1>
          <p className="section-sub mb-8">
            Below is the full record: the live example portfolio since
            inception, and the {BACKTEST.yearsCovered}-year walk-forward
            backtrained model that was tested before we charged anyone. Simulated
            results are labeled as such — they are not a realized track record.
          </p>
          <div className="flex flex-wrap gap-3">
            <PillButton href="/subscribe" arrow data-fast-goal={DATAFAST_CHECKOUT_GOAL}>
              Start your membership
            </PillButton>
            <Link href="/#what-how" className="btn-outline">
              How Outpick works
            </Link>
          </div>
        </div>
      </div>

      <TrackRecord initialStrategy={strategy} />
    </>
  );
}
