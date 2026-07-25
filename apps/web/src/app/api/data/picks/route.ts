import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { PUBLIC_API_BASE } from "@/lib/api-config";
import { NO_STORE_HEADERS, requireSubscriber } from "@/lib/api-gate";

// Per-user gated: never prerender, never share a cached response.
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const gate = await requireSubscriber();
  if (!gate.ok) return gate.response;

  const status = request.nextUrl.searchParams.get("status") || "active";
  const res = await fetch(
    `${PUBLIC_API_BASE}/picks?status=${encodeURIComponent(status)}`,
    { cache: "no-store" }
  );
  if (!res.ok) {
    return NextResponse.json({ error: "upstream" }, { status: res.status });
  }
  return NextResponse.json(await res.json(), { headers: NO_STORE_HEADERS });
}
