import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { notFound } from "next/navigation";

import { getAccess } from "@/lib/api-gate";
import { SITE_NAME, SITE_URL } from "@/lib/constants";
import { getInsightBySlug } from "@/lib/insights";
import { CategoryTag } from "@/components/ui/category-tag";

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
  const url = `${SITE_URL}/insights/${meta.slug}`;

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
  const d = new Date(iso + "T12:00:00Z");
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
      ? "QUARTERLY REVIEW"
      : meta.ticker
        ? `PICK · ${meta.ticker}`
        : "PICK";

  const tone = meta.postType === "quarterly_review" ? "lilac" : "yellow";

  return (
    <article>
      <header className="border-b border-border">
        <div className="container-op pt-14 pb-16">
          <Link
            href="/insights"
            className="inline-flex items-center gap-2 font-sans text-[12px] font-bold tracking-[0.1em] uppercase text-text-dim hover:text-text transition-colors mb-10"
          >
            <ArrowLeft size={12} />
            All insights
          </Link>

          <div className="flex flex-wrap items-center gap-3 mb-6">
            <CategoryTag tone={tone}>{categoryLabel}</CategoryTag>
            <span className="font-sans text-[13px] text-text-dim">
              {formatDate(meta.publishedAt)}
              {meta.quarter ? ` · ${meta.quarter}` : ""}
              {meta.readingTime ? ` · ${meta.readingTime} min read` : ""}
            </span>
          </div>

          <h1 className="font-sans text-[34px] sm:text-[42px] font-extrabold leading-[1.15] tracking-tight text-text max-w-[760px] mb-6">
            {meta.title}
          </h1>

          {meta.description && (
            <p className="font-sans text-[17px] text-text-muted leading-[1.6] max-w-[680px]">
              {meta.description}
            </p>
          )}
        </div>
      </header>

      <div className="container-op py-16">
        <Content />
      </div>
    </article>
  );
}
