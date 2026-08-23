import { PUBLIC_API_BASE } from "@/lib/api-config";
import { formatDayMonth } from "@/lib/portfolio";
import {
  weekChangePct,
} from "@/lib/weekly-summary";

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

export async function fetchWeekVsSpy(): Promise<{
  bookChangePct: number;
  spyChangePct: number;
} | null> {
  try {
    const res = await fetch(`${PUBLIC_API_BASE}/performance`, {
      cache: "no-store",
    });
    if (!res.ok) return null;
    const body = (await res.json()) as {
      series?: {
        date?: string;
        return_pct?: number | null;
        spy_return_pct?: number | null;
      }[];
    };
    const series = body.series ?? [];
    const book = weekChangePct(series);
    const spy = weekChangePct(
      series.map((p) => ({
        date: p.date,
        return_pct: p.spy_return_pct,
      })),
    );
    if (book === null || spy === null) return null;
    return { bookChangePct: book, spyChangePct: spy };
  } catch {
    return null;
  }
}
