import { NextResponse } from "next/server";
import { PUBLIC_API_BASE } from "@/lib/api-config";
import { NO_STORE_HEADERS, requireSubscriber } from "@/lib/api-gate";
import { MIN_EMPLOYEES, MIN_REVENUE } from "@/lib/workforce";

// Every company's growth, for the scatter: the members' view.
export const dynamic = "force-dynamic";

export async function GET() {
  const gate = await requireSubscriber();
  if (!gate.ok) return gate.response;

  const params = new URLSearchParams({
    min_revenue: String(MIN_REVENUE),
    min_employees: String(MIN_EMPLOYEES),
  });
  const res = await fetch(`${PUBLIC_API_BASE}/workforce-growth?${params}`, {
    cache: "no-store",
  });
  if (!res.ok) {
    return NextResponse.json({ error: "upstream" }, { status: res.status });
  }
  return NextResponse.json(await res.json(), { headers: NO_STORE_HEADERS });
}
