import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";
import {
  buildSitemapEntries,
  isExcludedSitemapPath,
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
  const now = new Date("2026-08-31T12:00:00Z");

  it("includes every public marketing URL and every blog post", () => {
    const urls = buildSitemapEntries({ now, articles }).map((e) => e.url);

    expect(urls).toContain("https://outpick.xyz/");
    expect(urls).toContain("https://outpick.xyz/blog");
    expect(urls).toContain("https://outpick.xyz/pricing");
    expect(urls).toContain("https://outpick.xyz/track-record");
    expect(urls).toContain("https://outpick.xyz/strategy");
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
      now,
      articles,
      samples: [{ slug: "wdc-buy-note", updatedAt: "2026-07-17T00:00:00.000Z" }],
    }).map((e) => e.url);

    expect(urls).toContain("https://outpick.xyz/research/wdc-buy-note");
  });

  it("never lists paid, auth, or API routes", () => {
    const urls = buildSitemapEntries({
      now,
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
      now,
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
      "/strategy",
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
      now,
      articles: slugs.map((slug) => ({ slug, publishedAt: "2026-01-01" })),
    }).map((e) => e.url);
    for (const slug of slugs) {
      expect(urls).toContain(`https://outpick.xyz/blog/${slug}`);
    }
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
