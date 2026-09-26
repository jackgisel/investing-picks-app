import { NextResponse } from "next/server";
import { PUBLIC_API_BASE } from "@/lib/api-config";
import { NO_STORE_HEADERS, requireSubscriber } from "@/lib/api-gate";

// Gated like /picks: the scorecard is every pick by ticker.
export const dynamic = "force-dynamic";

export async function GET() {
  const gate = await requireSubscriber();
  if (!gate.ok) return gate.response;

  const res = await fetch(`${PUBLIC_API_BASE}/track-record`, {
    cache: "no-store",
  });
  if (!res.ok) {
    return NextResponse.json({ error: "upstream" }, { status: res.status });
  }
  return NextResponse.json(await res.json(), { headers: NO_STORE_HEADERS });
}
