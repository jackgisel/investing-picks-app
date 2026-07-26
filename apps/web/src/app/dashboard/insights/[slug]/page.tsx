import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { notFound } from "next/navigation";

import { getAccess } from "@/lib/api-gate";
import { SITE_NAME, SITE_URL } from "@/lib/constants";
import { getInsightBySlug } from "@/lib/insights";

type Params = { slug: string };

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const access = await getAccess();
  if (!access.entitled) {
    return {
      title: "Insights — Members only",
      robots: { index: false, follow: false },
    };
  }

  const { slug } = await params;
  const insight = getInsightBySlug(slug);
  if (!insight) return { robots: { index: false, follow: false } };

  const { meta } = insight;
  const url = `${SITE_URL}/dashboard/insights/${meta.slug}`;

  return {
    title: meta.title,
    description: meta.description,
    robots: { index: false, follow: false },
    alternates: { canonical: url },
    openGraph: {
      title: meta.title,
      description: meta.description,
      url,
      siteName: SITE_NAME,
      type: "article",
      publishedTime: meta.publishedAt,
      authors: meta.author ? [meta.author] : undefined,
      tags: meta.tags,
    },
    twitter: {
      card: "summary",
      title: meta.title,
      description: meta.description,
    },
  };
}

function formatDate(iso: string): string {
  const d = new Date(`${iso}T12:00:00Z`);
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}

export default async function InsightDetailPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { slug } = await params;
  const insight = getInsightBySlug(slug);
  if (!insight) notFound();

  const { meta, Content } = insight;

  const categoryLabel =
    meta.postType === "quarterly_review"
      ? "Quarterly review"
      : meta.ticker
        ? `Pick · ${meta.ticker}`
        : "Pick";

  const tone =
    meta.postType === "quarterly_review"
      ? "bg-accent-lilac/15"
      : "bg-accent-yellow/15";

  return (
    // The shell is 1400px wide for tables; long-form prose is not, so the
    // article caps itself at a reading measure. prose.tsx already holds its
    // own children to 680px — this keeps the header aligned with them.
    <article className="max-w-[760px]">
      <Link
        href="/dashboard/insights"
        className="inline-flex items-center gap-2 font-sans text-[11px] font-bold uppercase tracking-[0.1em] text-text-dim transition-colors hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
      >
        <ArrowLeft size={12} />
        All insights
      </Link>

      <header className="mt-6 border-b border-border pb-8">
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <span
            className={`inline-flex items-center rounded-lg px-2.5 py-1 font-sans text-[10px] font-bold uppercase tracking-[0.12em] text-text-muted ${tone}`}
          >
            {categoryLabel}
          </span>
          <span className="font-mono text-[11px] text-text-dim">
            {formatDate(meta.publishedAt)}
            {meta.quarter ? ` · ${meta.quarter}` : ""}
            {meta.readingTime ? ` · ${meta.readingTime} min read` : ""}
          </span>
        </div>

        <h1 className="font-sans text-[28px] font-bold leading-[1.2] tracking-tight text-text sm:text-[32px]">
          {meta.title}
        </h1>

        {meta.description && (
          <p className="mt-4 font-sans text-[16px] leading-[1.6] text-text-muted">
            {meta.description}
          </p>
        )}
      </header>

      <div className="pt-10">
        <Content />
      </div>
    </article>
  );
}
