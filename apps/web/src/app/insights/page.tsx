import type { Metadata } from "next";
import Link from "next/link";

import { SITE_NAME, SITE_URL } from "@/lib/constants";
import { insights, type Insight } from "@/lib/insights";
import { CategoryTag } from "@/components/ui/category-tag";

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

function formatDate(iso: string): string {
  const d = new Date(iso + "T12:00:00Z");
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

function categoryLabel(insight: Insight): string {
  if (insight.meta.postType === "quarterly_review") return "Quarterly review";
  return insight.meta.ticker ? `Pick · ${insight.meta.ticker}` : "Pick";
}

function InsightCard({
  insight,
  featured = false,
}: {
  insight: Insight;
  featured?: boolean;
}) {
  const tone =
    insight.meta.postType === "quarterly_review" ? "lilac" : "yellow";
  const { meta } = insight;

  if (featured) {
    return (
      <Link
        href={`/insights/${meta.slug}`}
        className="block soft-card hover:bg-bg-tertiary transition-colors group"
      >
        <div className="mb-5">
          <CategoryTag tone={tone}>{categoryLabel(insight)}</CategoryTag>
        </div>
        <h2 className="font-sans font-extrabold leading-[1.15] tracking-tight mb-4 text-text group-hover:opacity-70 transition-opacity text-[28px] sm:text-[32px] max-w-[720px]">
          {meta.title}
        </h2>
        <p className="font-sans text-[16px] text-text-muted leading-relaxed max-w-[640px]">
          {meta.description}
        </p>
        <p className="mt-6 font-sans text-[13px] text-text-dim">
          {formatDate(meta.publishedAt)}
          {meta.readingTime ? ` · ${meta.readingTime} min read` : ""}
        </p>
      </Link>
    );
  }

  return (
    <Link
      href={`/insights/${meta.slug}`}
      className="block soft-card hover:bg-bg-tertiary transition-colors group h-full"
    >
      <div className="mb-4">
        <CategoryTag tone={tone} className="!text-[10px] !px-3 !py-1.5">
          {categoryLabel(insight)}
        </CategoryTag>
      </div>
      <h3 className="font-sans font-bold leading-[1.25] tracking-tight mb-3 text-text group-hover:opacity-70 transition-opacity text-[18px]">
        {meta.title}
      </h3>
      <p className="font-sans text-[13px] text-text-muted leading-relaxed line-clamp-3">
        {meta.description}
      </p>
      <p className="mt-5 font-sans text-[12px] text-text-dim">
        {formatDate(meta.publishedAt)}
      </p>
    </Link>
  );
}

export default function InsightsIndexPage() {
  const [featured, ...rest] = insights;

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

      {insights.length === 0 ? (
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
                <InsightCard insight={featured} featured />
              </div>
            </section>
          )}

          {rest.length > 0 && (
            <section className="border-b border-border">
              <div className="container-op py-14">
                <p className="section-label mb-5">All insights</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {rest.map((insight) => (
                    <InsightCard key={insight.meta.slug} insight={insight} />
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
