import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArticleCard } from "@/components/blog/article-card";
import { TopicNav } from "@/components/blog/topic-nav";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { getArticlesInCategory } from "@/lib/blog";
import {
  BLOG_CATEGORIES,
  categoryPath,
  getCategoryBySlug,
  getSubcategory,
  subcategoryPath,
} from "@/lib/blog-taxonomy";
import { SITE_NAME, SITE_URL } from "@/lib/constants";

type Params = { category: string; subcategory: string };

export const dynamicParams = false;

export function generateStaticParams(): Params[] {
  return BLOG_CATEGORIES.flatMap((c) =>
    c.subcategories.map((s) => ({ category: c.slug, subcategory: s.slug })),
  );
}

async function resolve(params: Promise<Params>) {
  const p = await params;
  const category = getCategoryBySlug(p.category);
  const sub = getSubcategory(category, p.subcategory);
  return category && sub ? { category, sub } : null;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const found = await resolve(params);
  if (!found) return {};
  const { category, sub } = found;
  const url = `${SITE_URL}${subcategoryPath(category, sub)}`;
  const empty = getArticlesInCategory(category.name, sub.slug).length === 0;
  return {
    title: `${sub.name} articles`,
    description: sub.description,
    alternates: { canonical: url },
    // A topic with no posts yet is a thin page. It stays reachable from the
    // nav but out of the index until something is filed under it.
    robots: empty ? { index: false, follow: true } : undefined,
    openGraph: {
      title: `${sub.name} | ${SITE_NAME}`,
      description: sub.description,
      url,
      siteName: SITE_NAME,
      type: "website",
    },
  };
}

export default async function BlogSubcategoryPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const found = await resolve(params);
  if (!found) notFound();
  const { category, sub } = found;
  const posts = getArticlesInCategory(category.name, sub.slug);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: sub.name,
    description: sub.description,
    url: `${SITE_URL}${subcategoryPath(category, sub)}`,
    hasPart: posts.map((a) => ({
      "@type": "Article",
      headline: a.meta.title,
      url: `${SITE_URL}/blog/${a.meta.slug}`,
      datePublished: a.meta.publishedAt,
    })),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <section className="border-b border-border">
        <div className="container-op pt-8 pb-12 sm:pb-14">
          <Breadcrumbs
            items={[
              { label: "Blog", href: "/blog" },
              { label: category.name, href: categoryPath(category) },
              { label: sub.name, href: subcategoryPath(category, sub) },
            ]}
            className="mb-10"
          />
          <p className="section-label">{category.title}</p>
          <h1 className="font-sans text-[36px] sm:text-[44px] font-extrabold leading-[1.1] tracking-tight mb-4 max-w-[760px]">
            {sub.name}
          </h1>
          <p className="font-sans text-[17px] text-text-muted leading-relaxed max-w-[640px] mb-8">
            {sub.description}
          </p>
          <TopicNav category={category} activeSlug={sub.slug} />
        </div>
      </section>

      <section className="border-b border-border">
        <div className="container-op py-12 sm:py-14">
          {posts.length === 0 ? (
            <p className="font-sans text-[15px] text-text-muted">
              Nothing filed here yet. The first post is on its way.
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {posts.map((a) => (
                <ArticleCard key={a.meta.slug} meta={a.meta} />
              ))}
            </div>
          )}
        </div>
      </section>
    </>
  );
}
