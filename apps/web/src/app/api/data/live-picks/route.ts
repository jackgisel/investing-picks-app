import { NextResponse } from "next/server";
import { PUBLIC_API_BASE } from "@/lib/api-config";

/**
 * The three best-performing open positions, tickers included, for the landing
 * page.
 *
 * This is a deliberate hole in the boundary `anonymiseStrategy()` enforces:
 * everywhere else the marketing side gets percentages and never a ticker. The
 * product call is that three names are worth more as proof than as secrets,
 * and the rest of the book stays behind the membership.
 *
 * It is a separate route rather than a flag on /api/data/strategy on purpose.
 * Widening that route would have loosened the gate for every one of its
 * callers; this one can only ever return the four fields below, so the
 * exception cannot spread by accident.
 */
export const revalidate = 300;

/** How many names the landing page gives away. */
const PUBLIC_PICK_COUNT = 3;

type UpstreamHolding = {
  ticker?: string | null;
  name?: string | null;
  sector?: string | null;
  entry_date?: string | null;
  pnl_pct?: number | null;
};

export type LivePick = {
  ticker: string;
  name: string | null;
  sector: string | null;
  entryDate: string | null;
  pnlPct: number;
};

export type LivePicksResponse = {
  picks: LivePick[];
  /** Total open positions, so the page can say how many are held back. */
  positionCount: number;
};

const EMPTY: LivePicksResponse = { picks: [], positionCount: 0 };

export async function GET() {
  try {
    const res = await fetch(`${PUBLIC_API_BASE}/strategy`, {
      next: { revalidate: 300 },
    });
    if (!res.ok) return NextResponse.json(EMPTY);

    const body = (await res.json()) as {
      holdings?: UpstreamHolding[];
      portfolio?: { position_count?: number };
    };
    const holdings = Array.isArray(body.holdings) ? body.holdings : [];

    const picks = holdings
      // A null pnl_pct means the cost basis could not be rebuilt. Upstream is
      // careful never to coerce that to 0, and neither are we — a position we
      // cannot price has no business leading the landing page.
      .filter(
        (h): h is UpstreamHolding & { ticker: string; pnl_pct: number } =>
          typeof h.ticker === "string" &&
          h.ticker.length > 0 &&
          typeof h.pnl_pct === "number" &&
          Number.isFinite(h.pnl_pct)
      )
      .sort((a, b) => b.pnl_pct - a.pnl_pct)
      .slice(0, PUBLIC_PICK_COUNT)
      // Rebuilt field by field rather than spread-and-delete. Upstream owns
      // this payload and may add to it; anything new must not reach the public
      // without someone editing this list.
      .map(
        (h): LivePick => ({
          ticker: h.ticker,
          name: h.name ?? null,
          sector: h.sector ?? null,
          entryDate: h.entry_date ?? null,
          pnlPct: h.pnl_pct,
        })
      );

    return NextResponse.json({
      picks,
      positionCount: body.portfolio?.position_count ?? holdings.length,
    } satisfies LivePicksResponse);
  } catch {
    return NextResponse.json(EMPTY);
  }
}
