/**
 * Market-cap formatting and the standard size tiers.
 *
 * The tier boundaries are the conventional ones (FINRA and every broker's
 * screener use the same numbers): mega ≥ $200B, large $10B–$200B, mid
 * $2B–$10B, small $250M–$2B, micro below that. They are stated here rather
 * than inlined at the call site because the label is a claim about the name —
 * a subscriber reading "Mid" next to a ticker should be reading the same
 * definition their brokerage uses.
 */

/** `$1.24B` / `$48.3B` / `$1.2T`. Null or NaN becomes an em dash. */
export function formatCompactUsd(value: number | null | undefined): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return "—";
  const abs = Math.abs(value);
  const sign = value < 0 ? "-" : "";
  if (abs >= 1_000_000_000_000)
    return `${sign}$${(abs / 1_000_000_000_000).toFixed(abs >= 10_000_000_000_000 ? 1 : 2)}T`;
  if (abs >= 1_000_000_000)
    return `${sign}$${(abs / 1_000_000_000).toFixed(abs >= 10_000_000_000 ? 1 : 2)}B`;
  if (abs >= 1_000_000)
    return `${sign}$${(abs / 1_000_000).toFixed(abs >= 100_000_000 ? 0 : 1)}M`;
  return `${sign}$${abs.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

export type MarketCapTier = "Mega" | "Large" | "Mid" | "Small" | "Micro";

/** The standard size bucket for a market cap, or null when it is unknown. */
export function marketCapTier(
  value: number | null | undefined,
): MarketCapTier | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0)
    return null;
  if (value >= 200_000_000_000) return "Mega";
  if (value >= 10_000_000_000) return "Large";
  if (value >= 2_000_000_000) return "Mid";
  if (value >= 250_000_000) return "Small";
  return "Micro";
}
