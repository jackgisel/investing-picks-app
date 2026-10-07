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

// Rendered per request. A cached sitemap is built at deploy time, when the
// API is unreachable, and shipped without a single company page for an hour.
// The company directory fetch is cached for an hour on its own, and the
// sample-note query is one indexed read with a 2.5s cap.
export const dynamic = "force-dynamic";
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
