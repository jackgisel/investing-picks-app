import { PUBLIC_API_BASE } from "@/lib/api-config";
import { formatDayMonth } from "@/lib/portfolio";

/**
 * Live figures rendered beside a published note — not authored into the markdown,
 * so regenerating copy cannot desync the meter from the book's current score.
 */

export async function fetchQuantRatingForTicker(
  ticker: string | null | undefined,
): Promise<{ rating: number; asOf: string | null } | null> {
  if (!ticker) return null;
  try {
    const res = await fetch(`${PUBLIC_API_BASE}/picks?status=active`, {
      cache: "no-store",
    });
    if (!res.ok) return null;
    const body = (await res.json()) as {
      picks?: { ticker?: string; quant_rating?: number | null }[];
      rating_as_of?: string | null;
    };
    const pick = (body.picks ?? []).find(
      (p) => p.ticker?.toUpperCase() === ticker.toUpperCase(),
    );
    if (typeof pick?.quant_rating !== "number") return null;
    return {
      rating: pick.quant_rating,
      asOf: formatDayMonth(body.rating_as_of ?? null),
    };
  } catch {
    return null;
  }
}

/**
 * The picks' week against the S&P 500 on the same money.
 *
 * Week to date from `/period-returns`: each pick held at Friday's close
 * re-entered there, each buy since then its own lot, and SPY given the same
 * dollars on the same dates. The whole-book equity curve this used to read is
 * mostly idle cash, so it put a near-flat "book" beside a fully invested index.
 */
export async function fetchWeekVsSpy(): Promise<{
  picksChangePct: number;
  spyChangePct: number;
} | null> {
  try {
    const res = await fetch(`${PUBLIC_API_BASE}/period-returns`, {
      cache: "no-store",
    });
    if (!res.ok) return null;
    const body = (await res.json()) as {
      periods?: {
        id?: string;
        open_picks_return_pct?: number | null;
        spy_return_pct?: number | null;
      }[];
    };
    const week = body.periods?.find((p) => p.id === "week");
    const picks = week?.open_picks_return_pct;
    const spy = week?.spy_return_pct;
    if (typeof picks !== "number" || typeof spy !== "number") return null;
    return { picksChangePct: picks, spyChangePct: spy };
  } catch {
    return null;
  }
}
