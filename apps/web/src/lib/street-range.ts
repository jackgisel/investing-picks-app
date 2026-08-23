/**
 * Street analyst price-target consensus vs the latest mark.
 *
 * Third-party context only — never an Outpick price target.
 */

export type StreetRangeInput = {
  mark?: number | null;
  price_target_low?: number | null;
  price_target_mean?: number | null;
  price_target_high?: number | null;
  price_target_analyst_count?: number | null;
};

export type StreetRange = {
  low: number;
  mean: number;
  high: number;
  mark: number | null;
  analystCount: number | null;
  upsideToMeanPct: number | null;
  downsideToLowPct: number | null;
};

function finite(value: number | null | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function streetRangeFromFundamentals(
  facts: StreetRangeInput | null | undefined,
): StreetRange | null {
  if (!facts) return null;
  const low = finite(facts.price_target_low);
  const mean = finite(facts.price_target_mean);
  const high = finite(facts.price_target_high);
  if (low === null || mean === null || high === null) return null;
  if (!(low <= mean && mean <= high)) return null;

  const mark = finite(facts.mark);
  const analystCount = finite(facts.price_target_analyst_count);

  return {
    low,
    mean,
    high,
    mark,
    analystCount,
    upsideToMeanPct:
      mark !== null && mark > 0 ? ((mean - mark) / mark) * 100 : null,
    downsideToLowPct:
      mark !== null && mark > 0 ? ((low - mark) / mark) * 100 : null,
  };
}

export function formatStreetPrice(value: number): string {
  return `$${value.toLocaleString("en-US", {
    minimumFractionDigits: value >= 100 ? 0 : 2,
    maximumFractionDigits: value >= 100 ? 0 : 2,
  })}`;
}

export function formatStreetPct(value: number): string {
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(1)}%`;
}
