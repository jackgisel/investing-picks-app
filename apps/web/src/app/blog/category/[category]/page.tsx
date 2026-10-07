import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArticleCard } from "@/components/blog/article-card";
import { TopicNav } from "@/components/blog/topic-nav";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { getArticlesInCategory } from "@/lib/blog";
import {
  BLOG_CATEGORIES,
  categoryPath,
  getCategoryBySlug,
  subcategoryPath,
} from "@/lib/blog-taxonomy";
import { SITE_NAME, SITE_URL } from "@/lib/constants";

type Params = { category: string };

export const dynamicParams = false;

export function generateStaticParams(): Params[] {
  return BLOG_CATEGORIES.map((c) => ({ category: c.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { category: slug } = await params;
  const category = getCategoryBySlug(slug);
  if (!category) return {};
  const url = `${SITE_URL}${categoryPath(category)}`;
  return {
    title: `${category.title} articles`,
    description: category.description,
    alternates: { canonical: url },
    openGraph: {
      title: `${category.title} | ${SITE_NAME}`,
      description: category.description,
      url,
      siteName: SITE_NAME,
      type: "website",
    },
  };
}

export default async function BlogCategoryPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { category: slug } = await params;
  const category = getCategoryBySlug(slug);
  if (!category) notFound();

  const sections = category.subcategories
    .map((sub) => ({ sub, posts: getArticlesInCategory(category.name, sub.slug) }))
    .filter((s) => s.posts.length > 0);

  return (
    <>
      <section className="border-b border-border">
        <div className="container-op pt-8 pb-12 sm:pb-14">
          <Breadcrumbs
            items={[
              { label: "Blog", href: "/blog" },
              { label: category.name, href: categoryPath(category) },
            ]}
            className="mb-10"
          />
          <p className="section-label">Outpick blog</p>
          <h1 className="font-sans text-[36px] sm:text-[44px] font-extrabold leading-[1.1] tracking-tight mb-4 max-w-[760px]">
            {category.title}
          </h1>
          <p className="font-sans text-[17px] text-text-muted leading-relaxed max-w-[640px] mb-8">
            {category.description}
          </p>
          <TopicNav category={category} />
        </div>
      </section>

      {sections.map(({ sub, posts }) => (
        <section key={sub.slug} className="border-b border-border">
          <div className="container-op py-12 sm:py-14">
            <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
              <div className="max-w-[620px]">
                <h2 className="font-sans text-[24px] font-bold tracking-tight">
                  {sub.name}
                </h2>
                <p className="mt-1 font-sans text-[14px] text-text-muted leading-relaxed">
                  {sub.description}
                </p>
              </div>
              {posts.length > 3 && (
                <Link href={subcategoryPath(category, sub)} className="btn-outline">
                  All {posts.length}
                </Link>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {posts.slice(0, 3).map((a) => (
                <ArticleCard key={a.meta.slug} meta={a.meta} />
              ))}
            </div>
          </div>
        </section>
      ))}
    </>
  );
}
