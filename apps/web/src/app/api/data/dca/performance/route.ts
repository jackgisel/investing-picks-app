import { NextResponse } from "next/server";
import { PUBLIC_API_BASE } from "@/lib/api-config";
import { NO_STORE_HEADERS } from "@/lib/api-gate";
import { requireAdmin } from "@/lib/admin";

export const dynamic = "force-dynamic";

export async function GET() {
  const gate = await requireAdmin();
  if (!gate.ok) return gate.response;

  const res = await fetch(`${PUBLIC_API_BASE}/dca/performance`, {
    cache: "no-store",
  });
  if (!res.ok) {
    return NextResponse.json({ error: "upstream" }, { status: res.status });
  }
  return NextResponse.json(await res.json(), { headers: NO_STORE_HEADERS });
}
