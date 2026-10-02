import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { OPS_API_BASE } from "@/lib/api-config";
import { CARD_SIZE, IncomeVisualCard } from "./card";
import type { PeriodType } from "./model";
import type { IncomePayload, IncomeVisual } from "./visual";

export {
  incomeVisualDedupeKey,
  incomeVisualFrom,
  incomeVisualKey,
  incomeVisualPostText,
  TICKER_PATTERN,
  type IncomePayload,
  type IncomeVisual,
} from "./visual";

/** Server half of the income visuals: read what the worker stored, and draw it. */

export type IncomeListItem = {
  ticker: string;
  name: string | null;
  sector: string | null;
  market_cap: number | null;
  period: string;
  fiscal_label: string;
  accepted_date: string | null;
  revenue: number | null;
  held: boolean;
};

export type IncomeList = { recent: IncomeListItem[]; held: IncomeListItem[]; days: number };

function opsHeaders(): Record<string, string> | null {
  const key = process.env.OPS_API_KEY;
  return key ? { "X-Ops-Key": key } : null;
}

export async function fetchIncomePayload(
  ticker: string,
  periodType: PeriodType = "quarter",
): Promise<IncomePayload | null> {
  const headers = opsHeaders();
  if (!headers) return null;
  const res = await fetch(
    `${OPS_API_BASE}/income-statements/${encodeURIComponent(ticker)}?period_type=${periodType}`,
    { headers, cache: "no-store" },
  );
  if (!res.ok) return null;
  return (await res.json()) as IncomePayload;
}

export async function fetchIncomeList(days = 7): Promise<IncomeList | null> {
  const headers = opsHeaders();
  if (!headers) return null;
  const res = await fetch(`${OPS_API_BASE}/income-statements?days=${days}`, {
    headers,
    cache: "no-store",
  });
  if (!res.ok) return null;
  return (await res.json()) as IncomeList;
}

/** Pull one ticker from FMP through the API. Throws with the API's reason. */
export async function refreshIncomeStatement(ticker: string): Promise<void> {
  const headers = opsHeaders();
  if (!headers) throw new Error("OPS_API_KEY is not configured");
  const res = await fetch(
    `${OPS_API_BASE}/income-statements/${encodeURIComponent(ticker)}/refresh`,
    { method: "POST", headers, cache: "no-store" },
  );
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { detail?: string } | null;
    throw new Error(body?.detail ?? `Refresh failed (${res.status})`);
  }
}

let fontCache: Promise<Buffer[]> | null = null;

function fonts(): Promise<Buffer[]> {
  fontCache ??= Promise.all(
    [
      "fonts/outfit-500.ttf",
      "fonts/outfit-800.ttf",
      "fonts/ibm-plex-mono-500.ttf",
      "fonts/ibm-plex-mono-600.ttf",
    ].map((rel) => readFile(join(process.cwd(), "public", rel))),
  );
  return fontCache;
}

export async function renderIncomeVisual(
  visual: IncomeVisual,
  init: { headers?: Record<string, string> } = {},
): Promise<ImageResponse> {
  const [outfit500, outfit800, mono500, mono600] = await fonts();
  return new ImageResponse(
    (
      <IncomeVisualCard
        ticker={visual.payload.ticker}
        name={visual.payload.name}
        statement={visual.statement}
        flow={visual.flow}
        fonts={{ sans: "Outfit", mono: "IBM Plex Mono" }}
      />
    ),
    {
      width: CARD_SIZE,
      height: CARD_SIZE,
      headers: init.headers,
      fonts: [
        { name: "Outfit", data: outfit500, style: "normal", weight: 500 },
        { name: "Outfit", data: outfit800, style: "normal", weight: 800 },
        { name: "IBM Plex Mono", data: mono500, style: "normal", weight: 500 },
        { name: "IBM Plex Mono", data: mono600, style: "normal", weight: 600 },
      ],
    },
  );
}

export async function renderIncomeVisualPng(visual: IncomeVisual): Promise<Buffer> {
  const res = await renderIncomeVisual(visual);
  return Buffer.from(await res.arrayBuffer());
}
