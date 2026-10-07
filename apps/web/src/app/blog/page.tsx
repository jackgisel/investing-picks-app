import type { Metadata } from "next";
import Link from "next/link";
import { articles, getArticlesInCategory } from "@/lib/blog";
import {
  BLOG_CATEGORIES,
  categoryPath,
  categoryTone,
  getCategoryByName,
  getSubcategory,
  subcategoryPath,
} from "@/lib/blog-taxonomy";
import { CategoryTag } from "@/components/ui/category-tag";
import { artForArticle } from "@/lib/art";
import { ArtMasthead } from "@/components/art/art-masthead";
import { ArticleCard } from "@/components/blog/article-card";
import { SITE_NAME, SITE_URL } from "@/lib/constants";

export const metadata: Metadata = {
  title: "Blog: value investing, market cycles, and stock research",
  description:
    "Research notes on moving beyond index funds with intention. Strategy, performance analysis, and the methodology behind Outpick.",
  alternates: {
    canonical: `${SITE_URL}/blog`,
  },
  robots: { index: true, follow: true },
  openGraph: {
    title: `Blog | ${SITE_NAME}`,
    description:
      "Research notes on value investing, market cycles, and building a portfolio with intention.",
    url: `${SITE_URL}/blog`,
    siteName: SITE_NAME,
    type: "website",
  },
};

function formatShortDate(iso: string): string {
  return new Date(iso + "T12:00:00Z").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

export default function BlogIndexPage() {
  const [featured, ...rest] = articles;
  const latest = rest.slice(0, 6);
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
            live portfolio. Written for people who want to know why a stock is
            in the book, without taking on stock research as a second job.
          </p>
        </div>
      </section>

      {/* Topics first: with a growing archive, most visitors arrive looking
          for one subject, not for whatever was published last. */}
      <section className="border-b border-border">
        <div className="container-op py-14">
          <p className="section-label mb-5">Browse by topic</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {BLOG_CATEGORIES.map((c) => (
              <div key={c.slug} className="soft-card flex flex-col">
                <Link
                  href={categoryPath(c)}
                  className="group flex items-center justify-between gap-3"
                >
                  <CategoryTag tone={categoryTone(c.name)}>{c.name}</CategoryTag>
                  <span className="font-mono text-[12px] text-text-dim group-hover:text-text transition-colors">
                    {getArticlesInCategory(c.name).length} posts →
                  </span>
                </Link>
                <p className="mt-4 font-sans text-[14px] text-text-muted leading-relaxed">
                  {c.description}
                </p>
                <ul className="mt-5 space-y-1 border-t border-border pt-4">
                  {c.subcategories.map((sub) => (
                    <li key={sub.slug}>
                      <Link
                        href={subcategoryPath(c, sub)}
                        className="flex items-center justify-between gap-3 rounded-md py-1.5 font-sans text-[14px] font-semibold text-text hover:opacity-60 transition-opacity"
                      >
                        {sub.name}
                        <span className="font-mono text-[12px] font-normal text-text-dim">
                          {getArticlesInCategory(c.name, sub.slug).length}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {featured && (
        <section className="border-b border-border">
          <div className="container-op py-14">
            <p className="section-label mb-5">Latest</p>
            <ArticleCard meta={featured.meta} featured />
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {latest.map((a) => (
                <ArticleCard key={a.meta.slug} meta={a.meta} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* The whole archive as a plain list. Cheap to scan, and every post
          stays one link from the blog root however long the archive gets. */}
      <section className="border-b border-border">
        <div className="container-op py-14">
          <p className="section-label mb-5">Every article</p>
          <ul className="divide-y divide-border border-y border-border">
            {articles.map((a) => {
              const c = getCategoryByName(a.meta.category);
              const sub = getSubcategory(c, a.meta.subcategory);
              return (
                <li key={a.meta.slug}>
                  <Link
                    href={`/blog/${a.meta.slug}`}
                    className="group grid grid-cols-1 gap-1 py-4 sm:grid-cols-[1fr_auto] sm:items-baseline sm:gap-6"
                  >
                    <span className="font-sans text-[16px] font-semibold text-text group-hover:opacity-60 transition-opacity">
                      {a.meta.title}
                    </span>
                    <span className="font-sans text-[12px] text-text-dim sm:text-right whitespace-nowrap">
                      {sub ? `${sub.name} · ` : ""}
                      {formatShortDate(a.meta.publishedAt)}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      </section>
    </>
  );
}
