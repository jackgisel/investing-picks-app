import type { ComponentType } from "react";
import { filingErrors } from "@/lib/blog-taxonomy";

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
  /**
   * Sub-category slug, one of the category's entries in
   * `content/blog-taxonomy.json`. Checked at module load; a wrong value fails
   * the build.
   */
  subcategory: string;
  /** Free-form tags shown on cards */
  tags: string[];
  /** Reading time in minutes (calculated by writer at ~220 wpm) */
  readingTime: number;
  /** Author name */
  author?: string;
  /**
   * Optional unique dithered cover under /public (e.g. /art/covers/slug.png).
   * When omitted, the shared ART pool is hashed from the slug as a fallback.
   */
  cover?: string;
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
import onePickEveryTwoWeeks from "@/content/blog/why-we-publish-one-stock-pick-every-two-weeks";
import firstHundredDays from "@/content/blog/first-100-days-of-a-live-stock-portfolio";
import inflationNotMiddleEast from "@/content/blog/inflation-is-not-a-five-month-middle-east-story";
import japanTreasuryAiEnergy from "@/content/blog/japan-treasury-intervention-and-ai-energy-two-clocks";
import whenToSellAStock from "@/content/blog/when-to-sell-a-stock-thesis-broken";
import sp500ConcentrationRisk from "@/content/blog/sp-500-concentration-risk-what-index-investors-miss";
import howToReadAStockResearchThesis from "@/content/blog/how-to-read-a-stock-research-thesis";
import whatGoodStockResearchLooksLike from "@/content/blog/what-good-stock-research-looks-like";
import valueInvestingMoreThanCheapStocks from "@/content/blog/value-investing-more-than-cheap-stocks";
import anthropicIpoValuation from "@/content/blog/anthropic-ipo-valuation-outpick-screen";
import longTermInvestingWrittenThesis from "@/content/blog/long-term-investing-written-thesis";
import individualStockResearchThatStillHoldsUp from "@/content/blog/individual-stock-research-that-still-holds-up";
import earningsRevisionInvesting from "@/content/blog/earnings-revision-investing";
import marketCycleAnalysisStockInvestors from "@/content/blog/market-cycle-analysis-stock-investors";
import stockResearchMembershipWorthIt from "@/content/blog/is-a-stock-research-membership-worth-it";
import investmentThesisTemplate from "@/content/blog/investment-thesis-template";
import sectorRelativePerformance from "@/content/blog/sector-relative-performance";
import howToCalculateIntrinsicValue from "@/content/blog/how-to-calculate-intrinsic-value";
import howToAnalyzeCompetitiveAdvantage from "@/content/blog/how-to-analyze-competitive-advantage";
import freeCashFlowStockAnalysis from "@/content/blog/free-cash-flow-stock-analysis";
import shouldYouAverageDown from "@/content/blog/should-you-average-down-on-a-losing-stock";
import whatPercentageIndividualStocks from "@/content/blog/what-percentage-of-portfolio-should-be-individual-stocks";
import howToAssessProfitMargins from "@/content/blog/how-to-assess-profit-margins";
import stockDownsideRiskAnalysis from "@/content/blog/stock-downside-risk-analysis";
import buildingConcentratedStockPortfolios from "@/content/blog/building-concentrated-stock-portfolios";

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
  onePickEveryTwoWeeks,
  firstHundredDays,
  inflationNotMiddleEast,
  japanTreasuryAiEnergy,
  whenToSellAStock,
  sp500ConcentrationRisk,
  howToReadAStockResearchThesis,
  whatGoodStockResearchLooksLike,
  valueInvestingMoreThanCheapStocks,
  anthropicIpoValuation,
  longTermInvestingWrittenThesis,
  individualStockResearchThatStillHoldsUp,
  earningsRevisionInvesting,
  marketCycleAnalysisStockInvestors,
  stockResearchMembershipWorthIt,
  investmentThesisTemplate,
  sectorRelativePerformance,
  howToCalculateIntrinsicValue,
  howToAnalyzeCompetitiveAdvantage,
  freeCashFlowStockAnalysis,
  shouldYouAverageDown,
  whatPercentageIndividualStocks,
  howToAssessProfitMargins,
  stockDownsideRiskAnalysis,
  buildingConcentratedStockPortfolios,
].sort((a, b) => b.meta.publishedAt.localeCompare(a.meta.publishedAt));

// Fail the build, not the page, when a post is filed somewhere that has no
// category page to list it.
const misfiled = articles.flatMap((a) => filingErrors(a.meta));
if (misfiled.length > 0) {
  throw new Error(`Blog posts with an invalid category:\n${misfiled.join("\n")}`);
}

export function getArticlesInCategory(
  categoryName: string,
  subcategorySlug?: string,
): Article[] {
  return articles.filter(
    (a) =>
      a.meta.category === categoryName &&
      (!subcategorySlug || a.meta.subcategory === subcategorySlug),
  );
}

export function getArticleBySlug(slug: string): Article | undefined {
  return articles.find((a) => a.meta.slug === slug);
}

export function getRelatedArticles(
  currentSlug: string,
  limit = 3,
): Article[] {
  const current = getArticleBySlug(currentSlug);
  if (!current) return articles.slice(0, limit);

  // Score by category match (+3), same sub-category (+3 more) and tag overlap (+1 each)
  const scored = articles
    .filter((a) => a.meta.slug !== currentSlug)
    .map((a) => {
      let score = 0;
      if (a.meta.category === current.meta.category) score += 3;
      if (
        a.meta.category === current.meta.category &&
        a.meta.subcategory === current.meta.subcategory
      ) {
        score += 3;
      }
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
