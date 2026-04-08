import type { Metadata } from "next";
import { articles } from "@/lib/blog";
import { ArticleCard } from "@/components/blog/article-card";
import { SITE_NAME, SITE_URL } from "@/lib/constants";

export const metadata: Metadata = {
  title: "Blog — Stock picking, strategy, and outperforming the S&P 500",
  description:
    "Long-form research on how to beat the index without becoming a day trader. Strategy notes, performance analysis, and the methodology behind Outpick.",
  alternates: {
    canonical: `${SITE_URL}/blog`,
  },
  openGraph: {
    title: `Blog — ${SITE_NAME}`,
    description:
      "Long-form research on how to beat the index without becoming a day trader.",
    url: `${SITE_URL}/blog`,
    siteName: SITE_NAME,
    type: "website",
  },
};

export default function BlogIndexPage() {
  const [featured, ...rest] = articles;

  return (
    <>
      <section className="border-b border-border">
        <div className="container-op pt-20 pb-14">
          <p className="font-mono text-[11px] text-accent-green tracking-[3px] mb-5 uppercase">
            OUTPICK RESEARCH
          </p>
          <h1 className="font-sans text-[40px] sm:text-[48px] font-bold leading-[1.1] tracking-tight mb-6 max-w-[780px]">
            How to outperform the index — without becoming a day trader.
          </h1>
          <p className="font-sans text-[17px] text-text-muted leading-relaxed max-w-[640px]">
            Long-form notes on the strategy, the math, and the trades. Written
            for investors who want their portfolio working harder than VOO but
            don&apos;t want stock picking to become a second job.
          </p>
        </div>
      </section>

      {/* Featured */}
      {featured && (
        <section className="border-b border-border">
          <div className="container-op py-14">
            <p className="font-mono text-[10px] text-text-dim tracking-[2px] mb-5 uppercase">
              LATEST
            </p>
            <ArticleCard meta={featured.meta} featured />
          </div>
        </section>
      )}

      {/* Grid */}
      <section className="border-b border-border">
        <div className="container-op py-14">
          <p className="font-mono text-[10px] text-text-dim tracking-[2px] mb-5 uppercase">
            ALL ARTICLES
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-0.5 bg-border">
            {rest.map((a) => (
              <ArticleCard key={a.meta.slug} meta={a.meta} />
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
