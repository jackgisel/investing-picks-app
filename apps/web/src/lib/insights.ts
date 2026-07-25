import type { ComponentType } from "react";

export type InsightPostType = "pick" | "quarterly_review";

export type InsightMeta = {
  /** URL slug — must be kebab-case and unique */
  slug: string;
  /** Page <title> and H1 */
  title: string;
  /** Deck / short reason (~155 chars for meta description) */
  description: string;
  /** Ticker for pick posts; null for quarterly reviews */
  ticker: string | null;
  postType: InsightPostType;
  /** ISO date YYYY-MM-DD */
  publishedAt: string;
  /** Reading time in minutes (~220 wpm) */
  readingTime: number;
  author?: string;
  tags?: string[];
  /** Quarter label for quarterly_review posts */
  quarter?: string | null;
};

export type Insight = {
  meta: InsightMeta;
  Content: ComponentType;
};

// Static imports — each insight is a self-contained module under
// src/content/insights. Adding a new post means creating the file and
// importing it here. Order in the array does not matter — list page
// sorts by publishedAt descending, then ticker.
import sezl from "@/content/insights/sezl-buy-now-pay-later-platform-compounding";
import atlc from "@/content/insights/atlc-inclusive-consumer-credit-platform";
import wt from "@/content/insights/wt-wisdomtree-etf-and-digital-assets";
import roku from "@/content/insights/roku-streaming-platform-advertising-engine";
import sofi from "@/content/insights/sofi-digital-banking-everything-app";
import asic from "@/content/insights/asic-ategrity-specialty-insurance-es";
import skwd from "@/content/insights/skwd-skyward-specialty-pc-insurer";
import wdc from "@/content/insights/wdc-western-digital-ai-storage";

export const insights: Insight[] = [
  sezl,
  atlc,
  wt,
  roku,
  sofi,
  asic,
  skwd,
  wdc,
].sort(
  (a, b) =>
    b.meta.publishedAt.localeCompare(a.meta.publishedAt) ||
    (a.meta.ticker ?? "").localeCompare(b.meta.ticker ?? ""),
);

export function getInsightBySlug(slug: string): Insight | undefined {
  return insights.find((i) => i.meta.slug === slug);
}

export function getInsightByTicker(ticker: string): Insight | undefined {
  const upper = ticker.toUpperCase();
  return insights.find(
    (i) => i.meta.postType === "pick" && i.meta.ticker?.toUpperCase() === upper,
  );
}

export function getAllInsightSlugs(): string[] {
  return insights.map((i) => i.meta.slug);
}
