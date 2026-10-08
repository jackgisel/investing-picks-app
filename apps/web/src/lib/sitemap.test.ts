import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";
import {
  blogTopicRoutes,
  buildSitemapEntries,
  companySectorRoutes,
  isExcludedSitemapPath,
  newestSitemapDate,
  PUBLIC_STATIC_PATHS,
  SITEMAP_EXCLUDED_PATH_PREFIXES,
  toSitemapDate,
  withTimeout,
} from "./sitemap";

const articles = [
  { slug: "how-to-outperform-the-sp-500-with-stock-picks", publishedAt: "2026-01-14" },
  { slug: "walk-forward-backtesting-explained", publishedAt: "2026-06-17", updatedAt: "2026-06-20" },
];

describe("buildSitemapEntries", () => {
  it("includes every public marketing URL and every blog post", () => {
    const urls = buildSitemapEntries({ articles }).map((e) => e.url);

    expect(urls).toContain("https://outpick.xyz");
    expect(urls).not.toContain("https://outpick.xyz/");
    expect(urls).toContain("https://outpick.xyz/blog");
    expect(urls).toContain("https://outpick.xyz/pricing");
    expect(urls).toContain("https://outpick.xyz/track-record");
    expect(urls).toContain("https://outpick.xyz/strategy");
    expect(urls).toContain("https://outpick.xyz/tools");
    expect(urls).toContain(
      "https://outpick.xyz/tools/concentrated-portfolio-calculator",
    );
    expect(urls).toContain(
      "https://outpick.xyz/tools/average-down-calculator",
    );
    expect(urls).toContain("https://outpick.xyz/faq");
    expect(urls).toContain("https://outpick.xyz/market-note");
    expect(urls).toContain("https://outpick.xyz/what-we-are-not");
    expect(urls).toContain("https://outpick.xyz/terms");
    expect(urls).toContain("https://outpick.xyz/privacy");
    expect(urls).toContain(
      "https://outpick.xyz/blog/how-to-outperform-the-sp-500-with-stock-picks",
    );
    expect(urls).toContain(
      "https://outpick.xyz/blog/walk-forward-backtesting-explained",
    );
  });

  it("includes nominated public sample notes when provided", () => {
    const urls = buildSitemapEntries({
      articles,
      samples: [{ slug: "wdc-buy-note", updatedAt: "2026-07-17T00:00:00.000Z" }],
    }).map((e) => e.url);

    expect(urls).toContain("https://outpick.xyz/research/wdc-buy-note");
  });

  it("never lists paid, auth, or API routes", () => {
    const urls = buildSitemapEntries({
      articles,
      samples: [{ slug: "x", updatedAt: "2026-01-01" }],
    }).map((e) => e.url);

    for (const url of urls) {
      expect(isExcludedSitemapPath(url), url).toBe(false);
    }
    expect(urls.some((u) => u.includes("/dashboard"))).toBe(false);
    expect(urls.some((u) => u.includes("/login"))).toBe(false);
    expect(urls.some((u) => u.includes("/insights"))).toBe(false);
    expect(urls.some((u) => u.includes("/api"))).toBe(false);
    expect(urls.some((u) => u.includes("/subscribe"))).toBe(false);
  });

  it("omits lastModified rather than emitting an Invalid Date", () => {
    const [entry] = buildSitemapEntries({
      articles: [{ slug: "bad-date", publishedAt: "not-a-date" }],
    }).filter((e) => e.url.endsWith("/bad-date"));

    expect(entry).toBeDefined();
    expect(entry.lastModified).toBeUndefined();
  });

  it("covers the static path list used by the live sitemap", () => {
    expect(PUBLIC_STATIC_PATHS).toEqual([
      "/",
      "/blog",
      "/pricing",
      "/track-record",
      "/workforce",
      "/companies",
      "/strategy",
      "/tools",
      "/tools/beat-the-sp-500",
      "/tools/concentrated-portfolio-calculator",
      "/tools/profit-margin-calculator",
      "/tools/free-cash-flow-worksheet",
      "/tools/downside-risk-worksheet",
      "/tools/intrinsic-value-calculator",
      "/tools/competitive-advantage-worksheet",
      "/tools/average-down-calculator",
      "/faq",
      "/market-note",
      "/what-we-are-not",
      "/terms",
      "/privacy",
    ]);
    expect(SITEMAP_EXCLUDED_PATH_PREFIXES).toEqual([
      "/api",
      "/dashboard",
      "/insights",
      "/login",
      "/subscribe",
      "/welcome",
    ]);
  });

  it("would include a URL for every blog post module", () => {
    const blogDir = join(dirname(fileURLToPath(import.meta.url)), "../content/blog");
    const slugs = readdirSync(blogDir)
      .filter((f) => f.endsWith(".tsx"))
      .map((f) => {
        const src = readFileSync(join(blogDir, f), "utf8");
        const m = src.match(/slug:\s*"([^"]+)"/);
        expect(m, f).toBeTruthy();
        return m![1];
      });
    expect(slugs.length).toBeGreaterThan(0);
    const urls = buildSitemapEntries({
      articles: slugs.map((slug) => ({ slug, publishedAt: "2026-01-01" })),
    }).map((e) => e.url);
    for (const slug of slugs) {
      expect(urls).toContain(`https://outpick.xyz/blog/${slug}`);
    }
  });

  it("does not stamp static pages with the request time", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-07T12:00:00Z"));
    const entries = buildSitemapEntries({ articles });
    const home = entries.find((e) => e.url === "https://outpick.xyz");
    const pricing = entries.find((e) => e.url === "https://outpick.xyz/pricing");
    const blog = entries.find((e) => e.url === "https://outpick.xyz/blog");
    expect(home?.lastModified).toBeUndefined();
    expect(pricing?.lastModified).toBeUndefined();
    expect(blog?.lastModified?.toISOString()).toBe("2026-06-20T12:00:00.000Z");
    vi.useRealTimers();
  });
});

describe("newestSitemapDate", () => {
  it("picks the latest valid date and ignores garbage", () => {
    const d = newestSitemapDate(["2026-01-14", "not-a-date", "2026-06-20"]);
    expect(d?.toISOString()).toBe("2026-06-20T12:00:00.000Z");
    expect(newestSitemapDate([])).toBeUndefined();
  });
});

describe("toSitemapDate", () => {
  it("parses a calendar date as UTC noon so it does not slip a day", () => {
    const d = toSitemapDate("2026-01-14");
    expect(d?.toISOString()).toBe("2026-01-14T12:00:00.000Z");
  });

  it("returns undefined for garbage rather than an Invalid Date", () => {
    expect(toSitemapDate("yesterday")).toBeUndefined();
    expect(toSitemapDate("")).toBeUndefined();
    expect(toSitemapDate(new Date("nope"))).toBeUndefined();
  });
});

describe("withTimeout", () => {
  it("returns the fallback when the promise never settles", async () => {
    vi.useFakeTimers();
    const hung = new Promise<string>(() => {});
    const result = withTimeout(hung, 50, "fallback");
    await vi.advanceTimersByTimeAsync(50);
    await expect(result).resolves.toBe("fallback");
    vi.useRealTimers();
  });

  it("returns the value when the promise wins the race", async () => {
    await expect(withTimeout(Promise.resolve("ok"), 50, "fallback")).resolves.toBe(
      "ok",
    );
  });

  it("returns the fallback when the promise rejects", async () => {
    await expect(
      withTimeout(Promise.reject(new Error("db down")), 50, "fallback"),
    ).resolves.toBe("fallback");
  });
});

describe("generated routes", () => {
  it("lists a blog topic only when something is filed under it", () => {
    const routes = blogTopicRoutes(
      [
        {
          category: "Education",
          subcategory: "valuation",
          publishedAt: "2026-01-14",
          updatedAt: "2026-03-01",
        },
      ],
      [
        { name: "Education", slug: "education", subcategories: [{ slug: "valuation" }, { slug: "empty" }] },
        { name: "Markets", slug: "markets", subcategories: [{ slug: "macro" }] },
      ],
    );
    expect(routes.map((r) => r.path)).toEqual([
      "/blog/category/education",
      "/blog/category/education/valuation",
    ]);
    expect(routes[0].lastModified?.toISOString()).toBe("2026-03-01T12:00:00.000Z");
    expect(routes[1].lastModified?.toISOString()).toBe("2026-03-01T12:00:00.000Z");
  });

  it("stamps a sector page with the newest filing date of its companies", () => {
    const routes = companySectorRoutes(
      [
        { sector: "Technology", stale: false, filing_date: "2025-10-01" },
        { sector: "Technology", stale: false, filing_date: "2026-02-15" },
        { sector: "Healthcare", stale: true, filing_date: "2026-09-01" },
        { sector: null, stale: false, filing_date: "2026-01-01" },
      ],
      (s) => s.toLowerCase(),
    );
    expect(routes).toHaveLength(1);
    expect(routes[0].path).toBe("/companies/sector/technology");
    expect(routes[0].lastModified?.toISOString()).toBe("2026-02-15T12:00:00.000Z");
  });

  it("turns extra paths into same-site URLs", () => {
    const entries = buildSitemapEntries({
      siteUrl: "https://outpick.xyz",
      articles: [],
      extra: [{ path: "/companies/aapl", priority: 0.6 }],
    });
    expect(entries.map((e) => e.url)).toContain("https://outpick.xyz/companies/aapl");
  });
});
