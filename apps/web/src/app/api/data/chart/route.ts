import { NextResponse } from "next/server";
import { PUBLIC_API_BASE } from "@/lib/api-config";

// Public: a percentage-only equity curve vs SPY. No holdings, no tickers —
// this is the marketing track record, so logged-out visitors must see it.
export async function GET() {
  const res = await fetch(`${PUBLIC_API_BASE}/chart`, {
    next: { revalidate: 3600 },
  });
  if (!res.ok) {
    return NextResponse.json({ error: "upstream" }, { status: res.status });
  }
  return NextResponse.json(await res.json());
}
