import { NextResponse } from "next/server";
import { OPS_API_BASE } from "@/lib/api-config";
import { opsHeaders, opsMisconfiguredResponse, requireAdmin } from "@/lib/admin";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  let headers: Record<string, string>;
  try {
    headers = opsHeaders();
  } catch (e) {
    return opsMisconfiguredResponse(e);
  }

  const incoming = new URL(request.url).searchParams;
  const upstream = new URLSearchParams();
  for (const key of ["start", "end", "fill", "compare", "detail"] as const) {
    const value = incoming.get(key);
    if (value !== null && value !== "") upstream.set(key, value);
  }
  const qs = upstream.toString();
  const res = await fetch(`${OPS_API_BASE}/replay${qs ? `?${qs}` : ""}`, {
    headers,
    cache: "no-store",
  });
  const body = await res.json().catch(() => ({ error: "upstream" }));
  return NextResponse.json(body, { status: res.status });
}
