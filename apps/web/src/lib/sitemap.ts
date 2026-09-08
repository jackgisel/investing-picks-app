import { SITE_URL } from "@/lib/constants";

/**
 * Public, indexable routes. Paid, auth, and API surfaces stay out of the
 * sitemap even when robots.txt already disallows them — Google should not be
 * invited to discover a 401.
 */
export const PUBLIC_STATIC_PATHS = [
  "/",
  "/blog",
  "/pricing",
  "/track-record",
  "/strategy",
  "/faq",
  "/market-note",
  "/what-we-are-not",
  "/terms",
  "/privacy",
] as const;

export const SITEMAP_EXCLUDED_PATH_PREFIXES = [
  "/api",
  "/dashboard",
  "/insights",
  "/login",
  "/subscribe",
  "/welcome",
] as const;

export type SitemapArticle = {
  slug: string;
  publishedAt: string;
  updatedAt?: string;
};

export type SitemapSample = {
  slug: string;
  updatedAt: string;
};

export type SitemapEntry = {
  url: string;
  lastModified?: Date;
  changeFrequency?:
    | "always"
    | "hourly"
    | "daily"
    | "weekly"
    | "monthly"
    | "yearly"
    | "never";
  priority?: number;
};

const STATIC_META: Record<
  (typeof PUBLIC_STATIC_PATHS)[number],
  { changeFrequency: SitemapEntry["changeFrequency"]; priority: number }
> = {
  "/": { changeFrequency: "weekly", priority: 1.0 },
  "/blog": { changeFrequency: "weekly", priority: 0.9 },
  "/pricing": { changeFrequency: "monthly", priority: 0.9 },
  "/track-record": { changeFrequency: "daily", priority: 0.9 },
  "/strategy": { changeFrequency: "monthly", priority: 0.8 },
  "/faq": { changeFrequency: "monthly", priority: 0.7 },
  "/market-note": { changeFrequency: "weekly", priority: 0.7 },
  "/what-we-are-not": { changeFrequency: "monthly", priority: 0.6 },
  "/terms": { changeFrequency: "yearly", priority: 0.2 },
  "/privacy": { changeFrequency: "yearly", priority: 0.2 },
};

const SAMPLE_QUERY_MS = 2500;

/** Drop invalid dates rather than hand Next an Invalid Date (that 500s). */
export function toSitemapDate(value: string | Date | undefined): Date | undefined {
  if (!value) return undefined;
  const d =
    value instanceof Date
      ? value
      : new Date(
          /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T12:00:00Z` : value,
        );
  return Number.isFinite(d.getTime()) ? d : undefined;
}

export function isExcludedSitemapPath(pathname: string): boolean {
  const path = pathname.startsWith("http")
    ? new URL(pathname).pathname
    : pathname;
  return SITEMAP_EXCLUDED_PATH_PREFIXES.some(
    (prefix) => path === prefix || path.startsWith(`${prefix}/`),
  );
}

export function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  fallback: T,
): Promise<T> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(fallback), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      () => {
        clearTimeout(timer);
        resolve(fallback);
      },
    );
  });
}

export function buildSitemapEntries(input: {
  siteUrl?: string;
  now?: Date;
  articles: SitemapArticle[];
  samples?: SitemapSample[];
}): SitemapEntry[] {
  const siteUrl = (input.siteUrl ?? SITE_URL).replace(/\/$/, "");
  const now = input.now ?? new Date();

  const staticRoutes: SitemapEntry[] = PUBLIC_STATIC_PATHS.map((path) => ({
    url: path === "/" ? `${siteUrl}/` : `${siteUrl}${path}`,
    lastModified: now,
    ...STATIC_META[path],
  }));

  const blogRoutes: SitemapEntry[] = input.articles.flatMap((article) => {
    const lastModified = toSitemapDate(article.updatedAt ?? article.publishedAt);
    const entry: SitemapEntry = {
      url: `${siteUrl}/blog/${article.slug}`,
      changeFrequency: "monthly",
      priority: 0.7,
    };
    if (lastModified) entry.lastModified = lastModified;
    return [entry];
  });

  const sampleRoutes: SitemapEntry[] = (input.samples ?? []).flatMap((sample) => {
    if (!sample.slug) return [];
    const lastModified = toSitemapDate(sample.updatedAt);
    const entry: SitemapEntry = {
      url: `${siteUrl}/research/${sample.slug}`,
      changeFrequency: "monthly",
      priority: 0.8,
    };
    if (lastModified) entry.lastModified = lastModified;
    return [entry];
  });

  return [...staticRoutes, ...blogRoutes, ...sampleRoutes].filter(
    (entry) => !isExcludedSitemapPath(entry.url),
  );
}

/**
 * Nominated public research samples. Dynamic-import so a `pg` failure cannot
 * take down the whole sitemap at module load, and timed so a hung Pool cannot
 * either.
 */
export async function loadPublicSampleRoutes(): Promise<SitemapSample[]> {
  try {
    const { listPublicSampleInsights } = await import("@/lib/insights-db");
    const samples = await withTimeout(
      listPublicSampleInsights(),
      SAMPLE_QUERY_MS,
      [],
    );
    return samples.map((s) => ({ slug: s.slug, updatedAt: s.updatedAt }));
  } catch {
    return [];
  }
}
