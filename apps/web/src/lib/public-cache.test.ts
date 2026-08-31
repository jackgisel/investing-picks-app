import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  cacheControlIsShortEnough,
  PUBLIC_CACHE_PAGE_FILES,
  PUBLIC_PAGE_EXPIRE_SECONDS,
  PUBLIC_PAGE_REVALIDATE_SECONDS,
} from "./public-cache";

const here = dirname(fileURLToPath(import.meta.url));
const webRoot = join(here, "..", "..");

function readWeb(rel: string): string {
  return readFileSync(join(webRoot, rel), "utf8");
}

function segmentConfig(src: string): {
  forceDynamic: boolean;
  revalidate: number | null;
} {
  const forceDynamic = /export const dynamic\s*=\s*["']force-dynamic["']/.test(src);
  const m = src.match(/export const revalidate\s*=\s*(\d+)/);
  return {
    forceDynamic,
    revalidate: m ? Number(m[1]) : null,
  };
}

describe("cacheControlIsShortEnough", () => {
  it("rejects Next's default year-long static and ISR headers", () => {
    expect(cacheControlIsShortEnough("s-maxage=31536000")).toBe(false);
    expect(
      cacheControlIsShortEnough("s-maxage=300, stale-while-revalidate=31535700"),
    ).toBe(false);
    expect(
      cacheControlIsShortEnough("s-maxage=60, stale-while-revalidate=31535940"),
    ).toBe(false);
  });

  it("accepts a 60s ISR window, no-store, and must-revalidate", () => {
    expect(
      cacheControlIsShortEnough("s-maxage=60, stale-while-revalidate=0"),
    ).toBe(true);
    expect(
      cacheControlIsShortEnough("s-maxage=60, stale-while-revalidate=60"),
    ).toBe(true);
    expect(
      cacheControlIsShortEnough(
        "private, no-cache, no-store, max-age=0, must-revalidate",
      ),
    ).toBe(true);
    expect(
      cacheControlIsShortEnough("public, max-age=0, must-revalidate"),
    ).toBe(true);
  });
});

describe("public page segment config cannot bake a year-long prerender", () => {
  it("caps ISR stale-while-revalidate in next.config.js", () => {
    const src = readWeb("next.config.js");
    const m = src.match(/expireTime:\s*(\d+)/);
    expect(m, "next.config.js must set expireTime").toBeTruthy();
    expect(Number(m![1])).toBe(PUBLIC_PAGE_EXPIRE_SECONDS);
    expect(PUBLIC_PAGE_EXPIRE_SECONDS).toBe(PUBLIC_PAGE_REVALIDATE_SECONDS);
  });

  it.each(PUBLIC_CACHE_PAGE_FILES)("%s", (rel) => {
    const { forceDynamic, revalidate } = segmentConfig(readWeb(rel));
    if (rel.endsWith("track-record/page.tsx")) {
      expect(forceDynamic, `${rel} must be force-dynamic so the live book is not prerendered at docker build`).toBe(true);
      return;
    }
    expect(
      revalidate,
      `${rel} must export revalidate (Next cannot inherit a TS constant)`,
    ).not.toBeNull();
    expect(revalidate).toBe(PUBLIC_PAGE_REVALIDATE_SECONDS);
    expect(forceDynamic).toBe(false);
  });

  it("fetches the live book uncached so a build-time miss cannot stick", () => {
    const src = readWeb("src/lib/public-strategy.ts");
    expect(src).toMatch(/cache:\s*["']no-store["']/);
    expect(src).toMatch(/unstable_noStore|noStore\(/);
    expect(src).not.toMatch(/next:\s*\{\s*revalidate:\s*300/);
  });
});
