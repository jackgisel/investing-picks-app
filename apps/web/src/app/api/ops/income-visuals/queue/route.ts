import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { ensureMigrations } from "@/lib/auth";
import { TICKER_PATTERN } from "@/lib/income-visual/server";
import { queueIncomeVisual } from "@/lib/income-visual/x";

export const dynamic = "force-dynamic";

/** Queue one ticker's visual as an X draft, outside the morning sweep. */
export async function POST(req: Request) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const body = (await req.json().catch(() => ({}))) as {
    ticker?: string;
    period_type?: string;
  };
  const ticker = (body.ticker ?? "").trim().toUpperCase();
  if (!TICKER_PATTERN.test(ticker)) {
    return NextResponse.json({ error: "Invalid ticker" }, { status: 400 });
  }

  await ensureMigrations();
  const result = await queueIncomeVisual(
    ticker,
    body.period_type === "annual" ? "annual" : "quarter",
  );
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json(result);
}
