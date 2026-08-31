import type { MetadataRoute } from "next";
import { articles } from "@/lib/blog";
import { SITE_URL } from "@/lib/constants";
import { buildSitemapEntries, loadPublicSampleRoutes } from "@/lib/sitemap";

// Short ISR so a deploy cannot keep serving a sitemap that listed
// /dashboard and /login. Sample-note lookup is still cached for this
// window; it must never 500 the document (see loadPublicSampleRoutes).
export const revalidate = 60;
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
