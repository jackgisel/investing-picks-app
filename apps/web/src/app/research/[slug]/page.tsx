import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { notFound } from "next/navigation";

import { InsightBody, InsightHeader } from "@/components/blog/insight-article";
import { MarketNoteSignup } from "@/components/marketing/market-note-signup";
import { PillButton } from "@/components/ui/pill-button";
import { SITE_NAME, SITE_URL } from "@/lib/constants";
import { getPublicSampleBySlug, listPublicSampleInsights } from "@/lib/insights-db";

type Params = { slug: string };

/**
 * A real research note, published in the open.
 *
 * Every other insight is members-only and noindex. Exactly one pick note and
 * one exit note are nominated from ops as the public specimen — see
 * `public_sample_at` — so a visitor can read the actual product before paying
 * rather than a marketing description of it.
 *
 * Served from /research rather than /insights because robots.ts disallows
 * /insights, which is the whole point of that rule: every URL under it is
 * gated. This page is the deliberate exception and needs its own path to be
 * indexable at all.
 *
 * `getPublicSampleBySlug` checks BOTH the nomination and `status = 'approved'`,
 * so an unreviewed draft cannot reach this route even if someone nominates one.
 */

export const revalidate = 3600;

export async function generateStaticParams() {
  const samples = await listPublicSampleInsights().catch(() => []);
  return samples.map((s) => ({ slug: s.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { slug } = await params;
  const insight = await getPublicSampleBySlug(slug);
  if (!insight) return { robots: { index: false, follow: false } };

  const title = insight.title ?? undefined;
  const description = insight.description ?? undefined;

  return {
    title,
    description,
    // The one insight surface that is deliberately indexable.
    alternates: { canonical: `/research/${insight.slug}` },
    openGraph: {
      title,
      description,
      url: `${SITE_URL}/research/${insight.slug}`,
      siteName: SITE_NAME,
      type: "article",
      publishedTime: insight.publishedAt ?? undefined,
      authors: insight.author ? [insight.author] : undefined,
      tags: insight.tags,
    },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default async function PublicResearchPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { slug } = await params;
  const insight = await getPublicSampleBySlug(slug);
  if (!insight) notFound();

  const isExit = insight.postType === "exit";
  const published = insight.publishedAt ?? insight.createdAt;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: insight.title,
    description: insight.description,
    datePublished: published,
    dateModified: insight.updatedAt,
    author: {
      "@type": "Organization",
      name: insight.author ?? "Outpick Research",
      url: SITE_URL,
    },
    publisher: { "@type": "Organization", name: SITE_NAME, url: SITE_URL },
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": `${SITE_URL}/research/${insight.slug}`,
    },
    ...(insight.tags.length ? { keywords: insight.tags.join(", ") } : {}),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <div className="container-op py-10 sm:py-14">
        <article className="mx-auto max-w-[760px]">
          <Link
            href="/#sample-research"
            className="inline-flex items-center gap-2 rounded-sm font-sans text-[11px] font-bold uppercase tracking-[0.1em] text-text-dim transition-colors hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
          >
            <ArrowLeft size={12} />
            Sample research
          </Link>

          {/* Says what this is before the reader wonders. A real note published
              in full is easy to mistake for the whole product being free. */}
          <div className="mt-6 rounded-soft border border-accent-cyan/40 bg-accent-cyan/5 px-5 py-4">
            <p className="font-sans text-[11px] font-bold uppercase tracking-[0.12em] text-text-muted">
              Sample {isExit ? "exit note" : "research note"}
            </p>
            <p className="mt-1.5 font-sans text-[14px] leading-relaxed text-text-muted">
              {isExit
                ? "A real note from the live book, published in full. We write one of these every time a position closes — including the ones that lost money."
                : "A real note from the live book, published in full. Members get one of these every two weeks, plus an exit note when the position closes."}
            </p>
          </div>

          <InsightHeader insight={insight} />
          <InsightBody insight={insight} />

          <div className="mt-14 rounded-soft border border-border bg-bg-secondary/40 px-6 py-8 sm:px-8">
            <p className="section-label section-label-mint">
              This is the product
            </p>
            <h2 className="font-sans text-[22px] font-bold tracking-tight sm:text-[26px]">
              Every note, every position, every exit.
            </h2>
            <p className="mt-3 max-w-[52ch] font-sans text-[15px] leading-relaxed text-text-muted">
              One researched business every two weeks, the live book you can
              audit, and a note like this one when a position closes.
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-4">
              <PillButton href="/pricing" arrow>
                See membership
              </PillButton>
              <Link
                href="/track-record"
                className="rounded-sm font-sans text-[12px] font-bold uppercase tracking-[0.1em] text-text-muted transition-colors hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
              >
                Full track record →
              </Link>
            </div>
          </div>

          <div className="mt-8">
            <MarketNoteSignup
              source={`research-sample:${insight.slug}`}
              variant="panel"
            />
          </div>
        </article>
      </div>
    </>
  );
}
