import { SITE_URL } from "@/lib/constants";

/**
 * Public, indexable routes. Paid, auth, and API surfaces stay out of the
 * sitemap even when robots.txt already disallows them — Google should not be
 * invited to discover a 401.
 */
export const PUBLIC_TOOL_PATHS = [
  "/tools",
  "/tools/beat-the-sp-500",
  "/tools/concentrated-portfolio-calculator",
  "/tools/profit-margin-calculator",
  "/tools/free-cash-flow-worksheet",
  "/tools/downside-risk-worksheet",
  "/tools/intrinsic-value-calculator",
  "/tools/competitive-advantage-worksheet",
] as const;

export const PUBLIC_STATIC_PATHS = [
  "/",
  "/blog",
  "/pricing",
  "/track-record",
  "/workforce",
  "/companies",
  "/strategy",
  ...PUBLIC_TOOL_PATHS,
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
  "/workforce": { changeFrequency: "weekly", priority: 0.8 },
  "/companies": { changeFrequency: "weekly", priority: 0.8 },
  "/strategy": { changeFrequency: "monthly", priority: 0.8 },
  "/tools": { changeFrequency: "monthly", priority: 0.75 },
  "/tools/beat-the-sp-500": { changeFrequency: "daily", priority: 0.8 },
  "/tools/concentrated-portfolio-calculator": {
    changeFrequency: "monthly",
    priority: 0.7,
  },
  "/tools/profit-margin-calculator": {
    changeFrequency: "monthly",
    priority: 0.7,
  },
  "/tools/free-cash-flow-worksheet": {
    changeFrequency: "monthly",
    priority: 0.7,
  },
  "/tools/downside-risk-worksheet": {
    changeFrequency: "monthly",
    priority: 0.7,
  },
  "/tools/intrinsic-value-calculator": {
    changeFrequency: "monthly",
    priority: 0.7,
  },
  "/tools/competitive-advantage-worksheet": {
    changeFrequency: "monthly",
    priority: 0.7,
  },
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

/** Newest valid date, or undefined when nothing parses. Never uses "now". */
export function newestSitemapDate(
  values: ReadonlyArray<string | Date | undefined>,
): Date | undefined {
  let newest: Date | undefined;
  for (const value of values) {
    const d = toSitemapDate(value);
    if (!d) continue;
    if (!newest || d.getTime() > newest.getTime()) newest = d;
  }
  return newest;
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
  articles: SitemapArticle[];
  samples?: SitemapSample[];
  /**
   * Generated pages: blog topics, company data pages. Paths, not URLs, so the
   * caller cannot point one at another host.
   */
  extra?: Array<Omit<SitemapEntry, "url"> & { path: string }>;
}): SitemapEntry[] {
  const siteUrl = (input.siteUrl ?? SITE_URL).replace(/\/$/, "");
  const blogIndexLastMod = newestSitemapDate(
    input.articles.map((a) => a.updatedAt ?? a.publishedAt),
  );

  const staticRoutes: SitemapEntry[] = PUBLIC_STATIC_PATHS.map((path) => {
    // Homepage canonical is `https://outpick.xyz` with no trailing slash.
    const entry: SitemapEntry = {
      url: path === "/" ? siteUrl : `${siteUrl}${path}`,
      ...STATIC_META[path],
    };
    if (path === "/blog" && blogIndexLastMod) {
      entry.lastModified = blogIndexLastMod;
    }
    return entry;
  });

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

  const extraRoutes: SitemapEntry[] = (input.extra ?? []).map(({ path, ...rest }) => ({
    url: `${siteUrl}${path}`,
    ...rest,
  }));

  return [...staticRoutes, ...blogRoutes, ...sampleRoutes, ...extraRoutes].filter(
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

export type SitemapExtra = Omit<SitemapEntry, "url"> & { path: string };

/**
 * Category and sub-category pages that have at least one post. An empty
 * sub-category is noindex on its own page, so it stays out of here too.
 */
export function blogTopicRoutes(
  articles: ReadonlyArray<{
    category: string;
    subcategory: string;
    publishedAt: string;
    updatedAt?: string;
  }>,
  categories: ReadonlyArray<{
    name: string;
    slug: string;
    subcategories: ReadonlyArray<{ slug: string }>;
  }>,
): SitemapExtra[] {
  return categories.flatMap((c) => {
    const inCategory = articles.filter((a) => a.category === c.name);
    if (inCategory.length === 0) return [];
    const categoryLastMod = newestSitemapDate(
      inCategory.map((a) => a.updatedAt ?? a.publishedAt),
    );
    return [
      {
        path: `/blog/category/${c.slug}`,
        changeFrequency: "weekly" as const,
        priority: 0.7,
        ...(categoryLastMod ? { lastModified: categoryLastMod } : {}),
      },
      ...c.subcategories
        .filter((s) => inCategory.some((a) => a.subcategory === s.slug))
        .map((s) => {
          const inSub = inCategory.filter((a) => a.subcategory === s.slug);
          const lastModified = newestSitemapDate(
            inSub.map((a) => a.updatedAt ?? a.publishedAt),
          );
          return {
            path: `/blog/category/${c.slug}/${s.slug}`,
            changeFrequency: "weekly" as const,
            priority: 0.6,
            ...(lastModified ? { lastModified } : {}),
          };
        }),
    ];
  });
}

export function companySectorRoutes(
  companies: ReadonlyArray<{
    sector: string | null;
    stale: boolean;
    filing_date: string;
  }>,
  toSlug: (sector: string) => string,
): SitemapExtra[] {
  const datesBySector = new Map<string, string[]>();
  for (const c of companies) {
    if (!c.sector || c.stale) continue;
    const dates = datesBySector.get(c.sector);
    if (dates) dates.push(c.filing_date);
    else datesBySector.set(c.sector, [c.filing_date]);
  }
  return [...datesBySector.entries()].map(([sector, dates]) => {
    const lastModified = newestSitemapDate(dates);
    return {
      path: `/companies/sector/${toSlug(sector)}`,
      changeFrequency: "weekly" as const,
      priority: 0.6,
      ...(lastModified ? { lastModified } : {}),
    };
  });
}

const DIRECTORY_QUERY_MS = 4000;

/** Every company page and sector page. Empty, never an error, when the API is down. */
export async function loadCompanyRoutes(): Promise<SitemapExtra[]> {
  try {
    const { getCompanyDirectory, sectorSlug } = await import("@/lib/companies");
    const directory = await withTimeout(getCompanyDirectory(), DIRECTORY_QUERY_MS, null);
    if (!directory) return [];
    const companies: SitemapExtra[] = directory.companies.map((c) => {
      const lastModified = toSitemapDate(c.filing_date);
      return {
        path: `/companies/${c.ticker.toLowerCase()}`,
        changeFrequency: "monthly" as const,
        priority: c.stale ? 0.3 : 0.6,
        ...(lastModified ? { lastModified } : {}),
      };
    });
    return [
      ...companySectorRoutes(directory.companies, sectorSlug),
      ...companies,
    ];
  } catch {
    return [];
  }
}
