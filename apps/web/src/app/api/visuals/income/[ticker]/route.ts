import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireSubscriber } from "@/lib/api-gate";
import {
  fetchIncomePayload,
  incomeVisualFrom,
  renderIncomeVisual,
  TICKER_PATTERN,
} from "@/lib/income-visual/server";

export const dynamic = "force-dynamic";

/**
 * The square income-statement PNG for one ticker.
 *
 * A name in the book is member content — its visual names a pick — so it is
 * paywalled exactly like `/api/data/picks`. Anything else is a public company's
 * public filing and is served to anyone, cacheably. Only stored statements are
 * drawn; this route never triggers a vendor fetch, so it cannot be used to
 * spend the FMP quota.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ ticker: string }> },
) {
  const ticker = (await params).ticker.toUpperCase().replace(/\.PNG$/, "");
  if (!TICKER_PATTERN.test(ticker)) {
    return NextResponse.json({ error: "Invalid ticker" }, { status: 400 });
  }
  const sp = request.nextUrl.searchParams;
  const periodType = sp.get("period_type") === "annual" ? "annual" : "quarter";

  const payload = await fetchIncomePayload(ticker, periodType);
  if (!payload || payload.statements.length === 0) {
    return NextResponse.json({ error: "No stored income statement" }, { status: 404 });
  }
  if (payload.held) {
    const gate = await requireSubscriber();
    if (!gate.ok) return gate.response;
  }

  const visual = incomeVisualFrom(payload, sp.get("period"));
  if (!visual) {
    return NextResponse.json(
      { error: "This statement cannot be drawn (no revenue reported)" },
      { status: 422 },
    );
  }

  return renderIncomeVisual(visual, {
    headers: {
      "Cache-Control": payload.held
        ? "private, no-store"
        : "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
