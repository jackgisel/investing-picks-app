import { NextResponse } from "next/server";
import { PUBLIC_API_BASE } from "@/lib/api-config";
import { NO_STORE_HEADERS, anonymiseStrategy, getAccess } from "@/lib/api-gate";

// Response differs per user (subscribers get tickers), so it must never be
// prerendered or served from a shared cache.
export const dynamic = "force-dynamic";

export async function GET() {
  const res = await fetch(`${PUBLIC_API_BASE}/strategy`, { cache: "no-store" });
  if (!res.ok) {
    return NextResponse.json({ error: "upstream" }, { status: res.status });
  }
  const data = await res.json();

  // The landing page needs aggregate numbers to render for logged-out
  // visitors, but holdings and the ticker list are the paid product. Non
  // subscribers get counts and percentages with identifying fields removed.
  const access = await getAccess();
  const payload = access.entitled ? data : anonymiseStrategy(data);

  return NextResponse.json(payload, { headers: NO_STORE_HEADERS });
}
