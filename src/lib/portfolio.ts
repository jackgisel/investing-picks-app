import type { StrategyData } from "@/lib/hooks/use-strategy";

/**
 * Read the live portfolio's total return % from the strategy response.
 *
 * The backend computes this directly and exposes it on the response so the
 * frontend never needs to touch dollar fields. Returns null while loading
 * or if the backend can't compute it (e.g. empty portfolio).
 */
export function computePortfolioReturnPct(
  strategy: StrategyData | undefined
): number | null {
  if (!strategy?.portfolio) return null;
  return strategy.portfolio.total_return_pct ?? null;
}

export function formatPct(n: number, digits = 2): string {
  const sign = n >= 0 ? "+" : "";
  return `${sign}${n.toFixed(digits)}%`;
}
