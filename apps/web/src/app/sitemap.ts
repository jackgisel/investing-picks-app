import type { MetadataRoute } from "next";
import { articles } from "@/lib/blog";
import { BLOG_CATEGORIES } from "@/lib/blog-taxonomy";
import { SITE_URL } from "@/lib/constants";
import {
  blogTopicRoutes,
  buildSitemapEntries,
  loadCompanyRoutes,
  loadPublicSampleRoutes,
} from "@/lib/sitemap";

// Cached for an hour so a slow sample-note lookup cannot run on every crawl.
// force-dynamic would re-query Postgres on each Googlebot hit.
export const revalidate = 3600;
export const runtime = "nodejs";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const articleMetas = articles.map((a) => a.meta);
  const topics = blogTopicRoutes(articleMetas, BLOG_CATEGORIES);

  // Both loaders swallow their own failures: generated pages are additive and
  // must never 500 the document.
  const [samples, companies] = await Promise.all([
    loadPublicSampleRoutes(),
    loadCompanyRoutes(),
  ]);
  return buildSitemapEntries({
    siteUrl: SITE_URL,
    articles: articleMetas,
    samples,
    extra: [...topics, ...companies],
  });
}
