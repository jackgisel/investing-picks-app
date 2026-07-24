import type { ComponentType } from "react";

export type ArticleCategory =
  | "Strategy"
  | "Education"
  | "Performance"
  | "Research"
  | "Markets";

export type ArticleMeta = {
  /** URL slug — must be kebab-case and unique */
  slug: string;
  /** Page <title> and H1 */
  title: string;
  /** ~155 char meta description (also used as deck) */
  description: string;
  /** Primary long-tail keyword the article is targeting */
  keyword: string;
  /** Additional keywords for the OG/meta tags */
  keywords: string[];
  /** ISO date YYYY-MM-DD */
  publishedAt: string;
  /** ISO date YYYY-MM-DD — optional */
  updatedAt?: string;
  /** Display category */
  category: ArticleCategory;
  /** Free-form tags shown on cards */
  tags: string[];
  /** Reading time in minutes (calculated by writer at ~220 wpm) */
  readingTime: number;
  /** Author name */
  author?: string;
};

export type Article = {
  meta: ArticleMeta;
  Content: ComponentType;
};

// Static imports — each blog post is a self-contained module under
// src/content/blog. Adding a new post means creating the file and
// importing it here. Order in the array does not matter — list page
// sorts by publishedAt descending.
import howToOutperformSp500 from "@/content/blog/how-to-outperform-the-sp-500-with-stock-picks";
import beatSp500WithoutDayTrading from "@/content/blog/how-to-beat-the-sp-500-without-becoming-a-day-trader";
import bestStockPickingNewsletters from "@/content/blog/best-stock-picking-newsletters-for-long-term-investors";
import smallCapStocksBeatIndex from "@/content/blog/small-cap-stocks-that-beat-the-sp-500";
import howManyStocksToHold from "@/content/blog/how-many-stocks-should-you-hold-to-beat-the-market";
import isStockPickingWorthIt from "@/content/blog/is-paying-for-a-stock-picking-service-worth-it";
import sharpeRatioExplained from "@/content/blog/sharpe-ratio-explained-for-individual-investors";
import alphaVsBetaInvesting from "@/content/blog/alpha-vs-beta-what-active-stock-picking-actually-buys-you";
import findTenBaggers from "@/content/blog/how-to-find-10x-stocks-as-a-long-term-investor";
import goldMiningStocks2026 from "@/content/blog/why-gold-mining-stocks-are-outperforming-the-sp-500";
import argentinaStocks from "@/content/blog/argentina-stocks-the-quiet-engine-of-our-best-trades";
import walkForwardBacktesting from "@/content/blog/walk-forward-backtesting-explained";

export const articles: Article[] = [
  howToOutperformSp500,
  beatSp500WithoutDayTrading,
  bestStockPickingNewsletters,
  smallCapStocksBeatIndex,
  howManyStocksToHold,
  isStockPickingWorthIt,
  sharpeRatioExplained,
  alphaVsBetaInvesting,
  findTenBaggers,
  goldMiningStocks2026,
  argentinaStocks,
  walkForwardBacktesting,
].sort((a, b) => b.meta.publishedAt.localeCompare(a.meta.publishedAt));

export function getArticleBySlug(slug: string): Article | undefined {
  return articles.find((a) => a.meta.slug === slug);
}

export function getRelatedArticles(
  currentSlug: string,
  limit = 3,
): Article[] {
  const current = getArticleBySlug(currentSlug);
  if (!current) return articles.slice(0, limit);

  // Score by category match (+3) and tag overlap (+1 each)
  const scored = articles
    .filter((a) => a.meta.slug !== currentSlug)
    .map((a) => {
      let score = 0;
      if (a.meta.category === current.meta.category) score += 3;
      const overlap = a.meta.tags.filter((t) =>
        current.meta.tags.includes(t),
      ).length;
      score += overlap;
      return { article: a, score };
    })
    .sort((a, b) => b.score - a.score || b.article.meta.publishedAt.localeCompare(a.article.meta.publishedAt));

  return scored.slice(0, limit).map((s) => s.article);
}

export function getAllArticleSlugs(): string[] {
  return articles.map((a) => a.meta.slug);
}
