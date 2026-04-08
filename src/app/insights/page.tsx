import type { Metadata } from "next";
import Link from "next/link";

import { SITE_NAME, SITE_URL } from "@/lib/constants";

const API_BASE = process.env.ETF_API_URL || "https://etf.jackgisel.com/api/v1";

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
  title: "Insights — Why we bought every stock in the portfolio",
  description:
    "Live, post-by-post commentary on every Outpick pick. The reasoning behind each buy, the financials behind each name, and quarterly portfolio reviews.",
  alternates: {
    canonical: `${SITE_URL}/insights`,
  },
  openGraph: {
    title: `Insights — ${SITE_NAME}`,
    description:
      "Live commentary on every pick in the Outpick portfolio plus quarterly portfolio reviews.",
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
  if (post.post_type === "quarterly_review") return "QUARTERLY REVIEW";
  return post.ticker ? `PICK · ${post.ticker}` : "PICK";
}

function InsightCard({
  post,
  featured = false,
}: {
  post: BlogPostSummary;
  featured?: boolean;
}) {
  if (featured) {
    return (
      <Link
        href={`/insights/${post.slug}`}
        className="block bg-bg-secondary border border-border hover:border-accent-green/40 transition-colors p-9 group"
      >
        <div className="flex flex-wrap items-center gap-3 mb-5 font-mono text-[10px] tracking-[2px] uppercase">
          <span className="text-accent-green">{categoryLabel(post)}</span>
          <span className="text-text-dim">·</span>
          <span className="text-text-dim">{formatDate(post.published_at)}</span>
        </div>
        <h3 className="font-sans text-[26px] font-bold leading-[1.2] tracking-tight mb-3 text-text group-hover:text-accent-green transition-colors">
          {post.title}
        </h3>
        <p className="font-sans text-[15px] text-text-muted leading-relaxed max-w-[640px]">
          {post.excerpt}
        </p>
        <p className="mt-6 font-mono text-[11px] text-accent-green tracking-wider">
          READ INSIGHT →
        </p>
      </Link>
    );
  }

  return (
    <Link
      href={`/insights/${post.slug}`}
      className="block bg-bg-secondary hover:bg-bg-tertiary transition-colors p-7 group h-full"
    >
      <div className="flex items-center gap-3 mb-4 font-mono text-[10px] tracking-[2px] uppercase">
        <span className="text-accent-green">{categoryLabel(post)}</span>
      </div>
      <h3 className="font-sans font-bold leading-[1.25] tracking-tight mb-3 text-text group-hover:text-accent-green transition-colors text-[18px]">
        {post.title}
      </h3>
      <p className="font-sans text-[13px] text-text-muted leading-relaxed line-clamp-3">
        {post.excerpt}
      </p>
      <p className="mt-5 font-mono text-[10px] text-text-dim tracking-wider">
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
          <p className="font-mono text-[11px] text-accent-green tracking-[3px] mb-5 uppercase">
            OUTPICK INSIGHTS
          </p>
          <h1 className="font-sans text-[40px] sm:text-[48px] font-bold leading-[1.1] tracking-tight mb-6 max-w-[780px]">
            Every pick, explained. Every quarter, reviewed.
          </h1>
          <p className="font-sans text-[17px] text-text-muted leading-relaxed max-w-[640px]">
            Live commentary on every name in the portfolio — written when the
            buy fires, with the company background and the financial picture
            that earned it a slot. Plus a quarterly review of how the strategy
            actually performed.
          </p>
        </div>
      </section>

      {posts.length === 0 ? (
        <section className="border-b border-border">
          <div className="container-op py-20">
            <p className="font-mono text-[11px] text-text-dim tracking-[2px] uppercase">
              NO INSIGHTS YET
            </p>
            <p className="font-sans text-[17px] text-text-muted leading-relaxed mt-4 max-w-[640px]">
              The first batch is being written. Check back soon.
            </p>
          </div>
        </section>
      ) : (
        <>
          {featured && (
            <section className="border-b border-border">
              <div className="container-op py-14">
                <p className="font-mono text-[10px] text-text-dim tracking-[2px] mb-5 uppercase">
                  LATEST
                </p>
                <InsightCard post={featured} featured />
              </div>
            </section>
          )}

          {rest.length > 0 && (
            <section className="border-b border-border">
              <div className="container-op py-14">
                <p className="font-mono text-[10px] text-text-dim tracking-[2px] mb-5 uppercase">
                  ALL INSIGHTS
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-0.5 bg-border">
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
