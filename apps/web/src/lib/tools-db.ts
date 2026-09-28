import { pool } from "@/lib/db";
import type { ToolId } from "@/lib/tools/registry";
import { pickWhitelistedFields } from "@/lib/tools/whitelist";

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

function calendarDaysBetween(a: Date, b: Date): number {
  const ms = Math.abs(a.getTime() - b.getTime());
  return Math.floor(ms / (24 * 60 * 60 * 1000));
}

async function latestPriceWithinSessions(
  ticker: string,
): Promise<{ close: number; date: string } | null> {
  const { rows } = await pool.query<{ close: string; date: Date }>(
    `SELECT close, date
     FROM price_bars
     WHERE ticker = $1
     ORDER BY date DESC
     LIMIT 1`,
    [ticker],
  );
  const row = rows[0];
  if (!row) return null;
  const close = Number(row.close);
  if (!Number.isFinite(close)) return null;
  const barDate = row.date instanceof Date ? row.date : new Date(row.date);
  const today = new Date();
  if (calendarDaysBetween(today, barDate) > 7) return null;
  const iso = barDate.toISOString().slice(0, 10);
  return { close, date: iso };
}

export async function loadToolSnapshot(
  toolId: ToolId,
  tickerRaw: string,
  options?: { includePrice?: boolean },
): Promise<ToolSnapshotResponse | null> {
  const ticker = normalizeTicker(tickerRaw);
  if (!ticker) return null;

  const { rows } = await pool.query<{
    data: Record<string, unknown>;
    as_of: Date;
    name: string | null;
    sector: string | null;
    industry: string | null;
  }>(
    `SELECT f.data, f.as_of, s.name, s.sector, s.industry
     FROM fundamentals f
     LEFT JOIN stocks s ON s.ticker = f.ticker
     WHERE f.ticker = $1
     ORDER BY f.as_of DESC
     LIMIT 1`,
    [ticker],
  );

  const row = rows[0];
  if (!row) {
    return {
      ticker,
      name: null,
      sector: null,
      industry: null,
      asOf: null,
      fields: pickWhitelistedFields(toolId, {}),
      price: options?.includePrice
        ? await latestPriceWithinSessions(ticker)
        : null,
      missing: true,
    };
  }

  const asOf =
    row.as_of instanceof Date
      ? row.as_of.toISOString().slice(0, 10)
      : String(row.as_of).slice(0, 10);

  const price = options?.includePrice
    ? await latestPriceWithinSessions(ticker)
    : null;

  return {
    ticker,
    name: row.name,
    sector: row.sector,
    industry: row.industry,
    asOf,
    fields: pickWhitelistedFields(toolId, row.data ?? {}),
    price,
    missing: false,
  };
}
