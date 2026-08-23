import { PUBLIC_API_BASE } from "@/lib/api-config";
import {
  streetRangeFromFundamentals,
  type StreetRange,
  type StreetRangeInput,
} from "@/lib/street-range";

type StrategyPayload = {
  holdings?: Array<{
    ticker: string | null;
    fundamentals?: StreetRangeInput | null;
  }>;
};

/**
 * Street range for one ticker from the public strategy payload.
 * Returns null when the name is not held or consensus is incomplete.
 */
export async function fetchStreetRangeForTicker(
  ticker: string | null | undefined,
): Promise<StreetRange | null> {
  if (!ticker) return null;
  try {
    const res = await fetch(`${PUBLIC_API_BASE}/strategy`, {
      cache: "no-store",
    });
    if (!res.ok) return null;
    const body = (await res.json()) as StrategyPayload;
    const holding = (body.holdings ?? []).find(
      (h) => h.ticker?.toUpperCase() === ticker.toUpperCase(),
    );
    return streetRangeFromFundamentals(holding?.fundamentals ?? null);
  } catch {
    return null;
  }
}
