import type { MetadataRoute } from "next";
import { articles } from "@/lib/blog";
import { SITE_URL } from "@/lib/constants";
import { buildSitemapEntries, loadPublicSampleRoutes } from "@/lib/sitemap";

// Cached for an hour so a slow sample-note lookup cannot run on every crawl.
// force-dynamic would re-query Postgres on each Googlebot hit.
export const revalidate = 3600;
export const runtime = "nodejs";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const articleMetas = articles.map((a) => a.meta);

  try {
    const samples = await loadPublicSampleRoutes();
    return buildSitemapEntries({
      siteUrl: SITE_URL,
      articles: articleMetas,
      samples,
    });
  } catch {
    // Static + blog URLs are enough for Google to discover the public site.
    // Sample notes are additive; they must never 500 the document.
    return buildSitemapEntries({
      siteUrl: SITE_URL,
      articles: articleMetas,
    });
  }
}
