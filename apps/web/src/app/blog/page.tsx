import type { Metadata } from "next";
import { articles } from "@/lib/blog";
import { artForArticle } from "@/lib/art";
import { ArtMasthead } from "@/components/art/art-masthead";
import { ArticleCard } from "@/components/blog/article-card";
import { SITE_NAME, SITE_URL } from "@/lib/constants";

export const metadata: Metadata = {
  title: "Blog — Value investing, market cycles, and intentional stock research",
  description:
    "Research notes on moving beyond index funds with intention. Strategy, performance analysis, and the methodology behind Outpick.",
  alternates: {
    canonical: `${SITE_URL}/blog`,
  },
  robots: { index: true, follow: true },
  openGraph: {
    title: `Blog — ${SITE_NAME}`,
    description:
      "Research notes on value investing, market cycles, and building a portfolio with intention.",
    url: `${SITE_URL}/blog`,
    siteName: SITE_NAME,
    type: "website",
  },
};

export default function BlogIndexPage() {
  const [featured, ...rest] = articles;
  const indexArt = featured ? artForArticle(featured.meta) : artForArticle({ slug: "blog" });

  return (
    <>
      <section className="relative border-b border-border overflow-hidden">
        <ArtMasthead art={indexArt} size="lg" className="-mb-16 sm:-mb-20" />
        <div className="relative container-op pt-6 pb-14">
          <p className="section-label mb-5">Outpick research</p>
          <h1 className="font-sans text-[40px] sm:text-[48px] font-extrabold leading-[1.1] tracking-tight mb-6 max-w-[780px] uppercase">
            Research for investors who outgrew the index.
          </h1>
          <p className="font-sans text-[17px] text-text-muted leading-relaxed max-w-[640px]">
            Notes on value investing, market cycles, and the trades behind our
            live portfolio — written for people who want intention and
            transparency, not a second job in stock research.
          </p>
        </div>
      </section>

      {/* Featured */}
      {featured && (
        <section className="border-b border-border">
          <div className="container-op py-14">
            <p className="section-label mb-5">Latest</p>
            <ArticleCard meta={featured.meta} featured />
          </div>
        </section>
      )}

      {/* Grid */}
      <section className="border-b border-border">
        <div className="container-op py-14">
          <p className="section-label mb-5">All articles</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {rest.map((a) => (
              <ArticleCard key={a.meta.slug} meta={a.meta} />
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
