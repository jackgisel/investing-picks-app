import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  articles,
  getArticleBySlug,
  getRelatedArticles,
} from "@/lib/blog";
import { PostLayout } from "@/components/blog/post-layout";
import { SITE_NAME, SITE_URL } from "@/lib/constants";

type Params = { slug: string };

export function generateStaticParams(): Params[] {
  return articles.map((a) => ({ slug: a.meta.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { slug } = await params;
  const article = getArticleBySlug(slug);
  if (!article) return {};

  const url = `${SITE_URL}/blog/${article.meta.slug}`;

  return {
    title: article.meta.title,
    description: article.meta.description,
    keywords: [article.meta.keyword, ...article.meta.keywords],
    alternates: { canonical: url },
    openGraph: {
      title: article.meta.title,
      description: article.meta.description,
      url,
      siteName: SITE_NAME,
      type: "article",
      publishedTime: article.meta.publishedAt,
      modifiedTime: article.meta.updatedAt ?? article.meta.publishedAt,
      authors: article.meta.author ? [article.meta.author] : undefined,
      tags: article.meta.tags,
    },
    twitter: {
      card: "summary_large_image",
      title: article.meta.title,
      description: article.meta.description,
    },
  };
}

export default async function BlogPostPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { slug } = await params;
  const article = getArticleBySlug(slug);
  if (!article) notFound();

  const related = getRelatedArticles(slug, 3);
  const { meta, Content } = article;

  // JSON-LD article schema for SEO
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: meta.title,
    description: meta.description,
    datePublished: meta.publishedAt,
    dateModified: meta.updatedAt ?? meta.publishedAt,
    author: {
      "@type": "Organization",
      name: meta.author ?? "Outpick Research",
      url: SITE_URL,
    },
    publisher: {
      "@type": "Organization",
      name: SITE_NAME,
      url: SITE_URL,
    },
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": `${SITE_URL}/blog/${meta.slug}`,
    },
    keywords: [meta.keyword, ...meta.keywords].join(", "),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <PostLayout meta={meta} related={related}>
        <Content />
      </PostLayout>
    </>
  );
}
