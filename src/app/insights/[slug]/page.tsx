import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { notFound } from "next/navigation";

import { MarkdownProse } from "@/components/blog/markdown-prose";
import { SITE_NAME, SITE_URL } from "@/lib/constants";

const API_BASE = process.env.ETF_API_URL || "https://etf.jackgisel.com/api/v1";

interface BlogPostDetail {
  slug: string;
  title: string;
  post_type: "pick" | "quarterly_review";
  ticker: string | null;
  quarter: string | null;
  published_at: string;
  short_reason: string | null;
  content_md: string;
  trade: { date: string; side: "buy" | "sell"; ticker: string } | null;
}

interface BlogPostSummary {
  slug: string;
  post_type: "pick" | "quarterly_review";
}

type Params = { slug: string };

async function fetchPost(slug: string): Promise<BlogPostDetail | null> {
  try {
    const res = await fetch(`${API_BASE}/blog/${encodeURIComponent(slug)}`, {
      next: { revalidate: 3600 },
    });
    if (!res.ok) return null;
    const text = await res.text();
    return JSON.parse(text);
  } catch {
    return null;
  }
}

async function fetchAllSlugs(): Promise<BlogPostSummary[]> {
  try {
    const res = await fetch(`${API_BASE}/blog?type=all&limit=500`, {
      next: { revalidate: 3600 },
    });
    if (!res.ok) return [];
    const text = await res.text();
    const data = JSON.parse(text);
    return data.posts ?? [];
  } catch {
    return [];
  }
}

export async function generateStaticParams(): Promise<Params[]> {
  const posts = await fetchAllSlugs();
  return posts.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = await fetchPost(slug);
  if (!post) return {};
  const url = `${SITE_URL}/insights/${post.slug}`;
  const description =
    post.short_reason || post.content_md.slice(0, 200).replace(/\n+/g, " ");
  return {
    title: post.title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title: post.title,
      description,
      url,
      siteName: SITE_NAME,
      type: "article",
      publishedTime: post.published_at,
    },
    twitter: {
      card: "summary_large_image",
      title: post.title,
      description,
    },
  };
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

export default async function InsightDetailPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { slug } = await params;
  const post = await fetchPost(slug);
  if (!post) notFound();

  const categoryLabel =
    post.post_type === "quarterly_review"
      ? "QUARTERLY REVIEW"
      : post.ticker
        ? `PICK · ${post.ticker}`
        : "PICK";

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.title,
    description: post.short_reason ?? "",
    datePublished: post.published_at,
    author: { "@type": "Organization", name: "Outpick Research", url: SITE_URL },
    publisher: { "@type": "Organization", name: SITE_NAME, url: SITE_URL },
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": `${SITE_URL}/insights/${post.slug}`,
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <article>
        <header className="border-b border-border">
          <div className="container-op pt-14 pb-16">
            <Link
              href="/insights"
              className="inline-flex items-center gap-2 font-mono text-[11px] text-text-dim tracking-wider hover:text-accent-green transition-colors mb-10"
            >
              <ArrowLeft size={12} />
              ALL INSIGHTS
            </Link>

            <div className="flex flex-wrap items-center gap-4 mb-6 font-mono text-[10px] tracking-[2px] uppercase">
              <span className="text-accent-green">{categoryLabel}</span>
              <span className="text-text-dim">·</span>
              <span className="text-text-dim">{formatDate(post.published_at)}</span>
              {post.quarter && (
                <>
                  <span className="text-text-dim">·</span>
                  <span className="text-text-dim">{post.quarter}</span>
                </>
              )}
            </div>

            <h1 className="font-sans text-[34px] sm:text-[42px] font-bold leading-[1.15] tracking-tight text-text max-w-[760px] mb-6">
              {post.title}
            </h1>

            {post.short_reason && (
              <p className="font-sans text-[17px] text-text-muted leading-[1.6] max-w-[680px]">
                {post.short_reason}
              </p>
            )}
          </div>
        </header>

        <div className="container-op py-16">
          <MarkdownProse markdown={post.content_md} />
        </div>
      </article>
    </>
  );
}
