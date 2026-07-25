/**
 * Ticker → Insight slug for dashboard deep links.
 * Keep in sync with modules registered in `@/lib/insights`.
 */
export const INSIGHT_SLUG_BY_TICKER: Record<string, string> = {
  SEZL: "sezl-buy-now-pay-later-platform-compounding",
  ATLC: "atlc-inclusive-consumer-credit-platform",
  WT: "wt-wisdomtree-etf-and-digital-assets",
  ROKU: "roku-streaming-platform-advertising-engine",
  SOFI: "sofi-digital-banking-everything-app",
  ASIC: "asic-ategrity-specialty-insurance-es",
  SKWD: "skwd-skyward-specialty-pc-insurer",
  WDC: "wdc-western-digital-ai-storage",
};

export function getInsightSlugByTicker(ticker: string): string | undefined {
  return INSIGHT_SLUG_BY_TICKER[ticker.toUpperCase()];
}
