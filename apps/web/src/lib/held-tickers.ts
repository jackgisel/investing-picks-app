import { OPS_API_BASE } from "@/lib/api-config";

/** Open-position tickers. Null when the book cannot be read. */
export async function fetchHeldTickers(): Promise<Set<string> | null> {
  const key = process.env.OPS_API_KEY;
  if (!key) return null;
  try {
    const res = await fetch(`${OPS_API_BASE}/portfolio`, {
      headers: { "X-Ops-Key": key },
      cache: "no-store",
    });
    if (!res.ok) return null;
    const body = (await res.json()) as {
      positions?: { ticker?: string | null }[];
    };
    const tickers = (body.positions ?? [])
      .map((position) => position.ticker?.trim().toUpperCase())
      .filter((ticker): ticker is string => Boolean(ticker));
    return new Set(tickers);
  } catch {
    return null;
  }
}

export type BookPosition = {
  ticker: string;
  pnlPct: number | null;
  entryDate: string | null;
};

export async function fetchBookPositions(): Promise<BookPosition[] | null> {
  const key = process.env.OPS_API_KEY;
  if (!key) return null;
  try {
    const res = await fetch(`${OPS_API_BASE}/portfolio`, {
      headers: { "X-Ops-Key": key },
      cache: "no-store",
    });
    if (!res.ok) return null;
    const body = (await res.json()) as {
      positions?: {
        ticker?: string | null;
        pnl_pct?: number | null;
        entry_date?: string | null;
      }[];
    };
    return (body.positions ?? [])
      .filter((position) => position.ticker?.trim())
      .map((position) => ({
        ticker: position.ticker!.trim().toUpperCase(),
        pnlPct: typeof position.pnl_pct === "number" ? position.pnl_pct : null,
        entryDate: position.entry_date ?? null,
      }));
  } catch {
    return null;
  }
}
