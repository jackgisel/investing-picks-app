import { opsHeaders } from "@/lib/admin";
import { OPS_API_BASE } from "@/lib/api-config";
import type { ToolId } from "@/lib/tools/registry";
import { pickWhitelistedFields } from "@/lib/tools/whitelist";

/**
 * Ticker lookups for the public calculators.
 *
 * Fundamentals and prices live in the API's database, not this app's, so the
 * snapshot comes from `/api/ops/tools/snapshot/{ticker}` (ops key: the row is
 * the whole vendor record). Only the whitelisted fields for the tool asking
 * ever leave this function.
 */

export type ToolSnapshotResponse = {
  ticker: string;
  name: string | null;
  sector: string | null;
  industry: string | null;
  asOf: string | null;
  fields: Record<string, number | string | null>;
  price: { close: number; date: string } | null;
  missing: boolean;
};

const TICKER_RE = /^[A-Z][A-Z0-9.-]{0,15}$/;

export function normalizeTicker(raw: string): string | null {
  const t = raw.trim().toUpperCase();
  if (!t || !TICKER_RE.test(t)) return null;
  return t;
}

type ApiSnapshot = {
  ticker: string;
  name: string | null;
  sector: string | null;
  industry: string | null;
  as_of: string | null;
  data: Record<string, unknown> | null;
  price: { close: number; date: string } | null;
};

export async function loadToolSnapshot(
  toolId: ToolId,
  tickerRaw: string,
  options?: { includePrice?: boolean },
): Promise<ToolSnapshotResponse | null> {
  const ticker = normalizeTicker(tickerRaw);
  if (!ticker) return null;

  const res = await fetch(`${OPS_API_BASE}/tools/snapshot/${encodeURIComponent(ticker)}`, {
    headers: opsHeaders(),
    next: { revalidate: 900 },
    signal: AbortSignal.timeout(6000),
  });
  if (!res.ok) throw new Error(`tool snapshot returned ${res.status}`);
  const snap = (await res.json()) as ApiSnapshot;

  return {
    ticker,
    name: snap.name,
    sector: snap.sector,
    industry: snap.industry,
    asOf: snap.as_of,
    fields: pickWhitelistedFields(toolId, snap.data ?? {}),
    price: options?.includePrice ? snap.price : null,
    missing: snap.data === null,
  };
}
