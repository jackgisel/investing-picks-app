import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { CompanyLogo } from "@/components/ui/company-logo";
import { insightCategoryLabel } from "@/lib/insights";
import { listPublicSampleInsights } from "@/lib/insights-db";
import type { InsightMeta } from "@/lib/insights";

/**
 * Two real notes, published in full: one for a position we opened and one for a
 * position we closed.
 *
 * Reads the same `public_sample_at` nomination the /research routes serve, so
 * these cards can never advertise a note the public page would refuse. If
 * nothing is nominated the section renders nothing — an empty "sample research"
 * heading is worse than no heading.
 *
 * Server component. The homepage revalidates every minute, which is far more
 * often than the nomination changes.
 */
export async function SampleResearch() {
  const samples = await listPublicSampleInsights().catch(() => []);
  if (samples.length === 0) return null;

  // Buy note first: it is the thing a visitor came to evaluate. The exit note
  // is the surprise, and reads better as the second card.
  const ordered = [
    ...samples.filter((s) => s.postType === "pick"),
    ...samples.filter((s) => s.postType === "exit"),
    ...samples.filter((s) => s.postType !== "pick" && s.postType !== "exit"),
  ];

  const hasBoth =
    ordered.some((s) => s.postType === "pick") &&
    ordered.some((s) => s.postType === "exit");

  return (
    <section id="sample-research" className="border-b border-border">
      <div className="container-op py-16 sm:py-20">
        <div className="mb-9 max-w-[560px] sm:mb-11">
          <p className="section-label section-label-yellow">Sample research</p>
          <h2 className="section-title">Read the actual product.</h2>
          <p className="section-sub mb-0">
            {/* Copy tracks what is actually nominated. Promising "one for a
                position we opened, one for a position we closed" while showing
                a single card is a small lie the reader can see. */}
            {hasBoth
              ? "Not an excerpt and not a teaser — two complete notes from the live book. One for a position we opened, one for a position we closed."
              : "Not an excerpt and not a teaser — a complete note from the live book, exactly as members receive it."}
          </p>
        </div>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          {ordered.map((sample) => (
            <SampleCard key={sample.slug} sample={sample} />
          ))}
        </div>
      </div>
    </section>
  );
}

const BLURB: Record<string, string> = {
  pick: "Why the position was opened — the business, the case, the figures behind it, and what would have to be true for us to be wrong.",
  exit: "Why the position was closed — what changed, the specific rule that closed it, and what the round trip returned.",
};

function SampleCard({ sample }: { sample: InsightMeta }) {
  const isExit = sample.postType === "exit";

  return (
    <Link
      href={`/research/${sample.slug}`}
      className="group flex flex-col rounded-soft border border-border bg-bg p-6 transition-colors hover:border-border-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text focus-visible:ring-offset-2 focus-visible:ring-offset-bg sm:p-7"
    >
      <div className="mb-5 flex items-center gap-3">
        <span
          className={`inline-flex items-center rounded-lg px-2.5 py-1 font-sans text-[10px] font-bold uppercase tracking-[0.12em] text-text-muted ${
            isExit ? "bg-accent-peach/15" : "bg-accent-yellow/15"
          }`}
        >
          {insightCategoryLabel(sample)}
        </span>
        {sample.readingTime ? (
          <span className="font-mono text-[11px] text-text-dim">
            {sample.readingTime} min read
          </span>
        ) : null}
      </div>

      <div className="flex items-start gap-4">
        {sample.ticker ? <CompanyLogo ticker={sample.ticker} size="md" /> : null}
        <h3 className="font-sans text-[19px] font-bold leading-snug tracking-tight text-text sm:text-[20px]">
          {sample.title ?? sample.slug}
        </h3>
      </div>

      <p className="mt-4 font-sans text-[14px] leading-relaxed text-text-muted">
        {sample.description ?? BLURB[sample.postType] ?? ""}
      </p>

      <p className="mt-auto pt-6 inline-flex items-center gap-2 font-sans text-[13px] font-bold text-text">
        Read the full note
        <ArrowRight
          size={14}
          className="transition-transform group-hover:translate-x-0.5"
        />
      </p>
    </Link>
  );
}
