import type { Metadata } from "next";
import Link from "next/link";

import { SITE_NAME, SITE_URL } from "@/lib/constants";
import { CategoryTag } from "@/components/ui/category-tag";

const API_BASE = process.env.OUTPICK_API_URL
  ? `${process.env.OUTPICK_API_URL.replace(/\/$/, "")}/api/v1`
  : (process.env.ETF_API_URL || "http://localhost:8000/api/v1");

interface BlogPostSummary {
  slug: string;
  title: string;
  post_type: "pick" | "quarterly_review";
  ticker: string | null;
  quarter: string | null;
  published_at: string;
  excerpt: string;
}

interface BlogListResponse {
  thesis_id: number;
  count: number;
  posts: BlogPostSummary[];
}

export const metadata: Metadata = {
  title: "Insights — Research behind every position in the portfolio",
  description:
    "Live commentary on every Outpick pick — the thesis, the fundamentals, and the market cycle context behind each buy, plus quarterly portfolio reviews.",
  alternates: {
    canonical: `${SITE_URL}/insights`,
  },
  openGraph: {
    title: `Insights — ${SITE_NAME}`,
    description:
      "Live research notes on every pick in the Outpick portfolio, plus quarterly reviews.",
    url: `${SITE_URL}/insights`,
    siteName: SITE_NAME,
    type: "website",
  },
};

async function fetchInsights(): Promise<BlogListResponse> {
  try {
    const res = await fetch(`${API_BASE}/blog?type=all&limit=100`, {
      next: { revalidate: 3600 },
    });
    if (!res.ok) return { thesis_id: 1, count: 0, posts: [] };
    const text = await res.text();
    return JSON.parse(text);
  } catch {
    return { thesis_id: 1, count: 0, posts: [] };
  }
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

function categoryLabel(post: BlogPostSummary): string {
  if (post.post_type === "quarterly_review") return "Quarterly review";
  return post.ticker ? `Pick · ${post.ticker}` : "Pick";
}

function InsightCard({
  post,
  featured = false,
}: {
  post: BlogPostSummary;
  featured?: boolean;
}) {
  const tone = post.post_type === "quarterly_review" ? "lilac" : "yellow";

  if (featured) {
    return (
      <Link
        href={`/insights/${post.slug}`}
        className="block soft-card hover:bg-bg-tertiary transition-colors group"
      >
        <div className="flex flex-wrap items-center gap-3 mb-5">
          <CategoryTag tone={tone}>{categoryLabel(post)}</CategoryTag>
          <span className="font-sans text-[12px] text-text-dim">
            {formatDate(post.published_at)}
          </span>
        </div>
        <h3 className="font-sans text-[26px] font-bold leading-[1.2] tracking-tight mb-3 text-text group-hover:opacity-70 transition-opacity">
          {post.title}
        </h3>
        <p className="font-sans text-[15px] text-text-muted leading-relaxed max-w-[640px] mb-6">
          {post.excerpt}
        </p>
        <span className="pill-solid text-[11px]">
          Read insight <span className="ml-1">→</span>
        </span>
      </Link>
    );
  }

  return (
    <Link
      href={`/insights/${post.slug}`}
      className="block soft-card hover:bg-bg-tertiary transition-colors group h-full"
    >
      <div className="mb-4">
        <CategoryTag tone={tone} className="!text-[10px] !px-3 !py-1.5">
          {categoryLabel(post)}
        </CategoryTag>
      </div>
      <h3 className="font-sans font-bold leading-[1.25] tracking-tight mb-3 text-text group-hover:opacity-70 transition-opacity text-[18px]">
        {post.title}
      </h3>
      <p className="font-sans text-[13px] text-text-muted leading-relaxed line-clamp-3">
        {post.excerpt}
      </p>
      <p className="mt-5 font-sans text-[12px] text-text-dim">
        {formatDate(post.published_at)}
      </p>
    </Link>
  );
}

export default async function InsightsIndexPage() {
  const { posts } = await fetchInsights();
  const [featured, ...rest] = posts;

  return (
    <>
      <section className="border-b border-border">
        <div className="container-op pt-20 pb-14">
          <p className="section-label">Outpick insights</p>
          <h1 className="font-sans text-[40px] sm:text-[48px] font-extrabold leading-[1.1] tracking-tight mb-6 max-w-[780px] uppercase">
            Every position, explained. Every quarter, reviewed.
          </h1>
          <p className="font-sans text-[17px] text-text-muted leading-relaxed max-w-[640px]">
            Live research on every name in the portfolio — the business thesis,
            the financials, and where we think we are in the cycle. Plus
            quarterly reviews of how the strategy actually performed.
          </p>
        </div>
      </section>

      {posts.length === 0 ? (
        <section className="border-b border-border">
          <div className="container-op py-20">
            <p className="section-label">No insights yet</p>
            <p className="font-sans text-[17px] text-text-muted leading-relaxed mt-2 max-w-[640px]">
              The first batch is being written. Check back soon.
            </p>
          </div>
        </section>
      ) : (
        <>
          {featured && (
            <section className="border-b border-border">
              <div className="container-op py-14">
                <p className="section-label mb-5">Latest</p>
                <InsightCard post={featured} featured />
              </div>
            </section>
          )}

          {rest.length > 0 && (
            <section className="border-b border-border">
              <div className="container-op py-14">
                <p className="section-label mb-5">All insights</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {rest.map((p) => (
                    <InsightCard key={p.slug} post={p} />
                  ))}
                </div>
              </div>
            </section>
          )}
        </>
      )}
    </>
  );
}
