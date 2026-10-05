import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import {
  fetchIncomeList,
  refreshIncomeStatement,
  TICKER_PATTERN,
} from "@/lib/income-visual/server";
import { incomeVisualConfig } from "@/lib/income-visual/x";
import { xCredentialsFromEnv } from "@/lib/x-client";

export const dynamic = "force-dynamic";

/** Recent filers and holdings with a stored statement, plus the X settings. */
export async function GET(req: Request) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const days = Number(new URL(req.url).searchParams.get("days") ?? 7);
  const list = await fetchIncomeList(Number.isFinite(days) ? days : 7);
  if (!list) {
    return NextResponse.json({ error: "Income statements unavailable from the API" }, { status: 502 });
  }
  return NextResponse.json({
    ...list,
    config: incomeVisualConfig(),
    xConfigured: xCredentialsFromEnv() !== null,
  });
}

/** Pull one ticker from FMP now so it can be previewed. */
export async function POST(req: Request) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const body = (await req.json().catch(() => ({}))) as { ticker?: string };
  const ticker = (body.ticker ?? "").trim().toUpperCase();
  if (!TICKER_PATTERN.test(ticker)) {
    return NextResponse.json({ error: "Enter a ticker" }, { status: 400 });
  }
  try {
    await refreshIncomeStatement(ticker);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Refresh failed" },
      { status: 502 },
    );
  }
  return NextResponse.json({ ticker });
}
