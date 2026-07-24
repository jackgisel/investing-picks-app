import { NextRequest, NextResponse } from "next/server";
import { OPS_API_BASE } from "@/lib/api-config";
import { opsHeaders, opsMisconfiguredResponse, requireAdmin } from "@/lib/admin";

export const dynamic = "force-dynamic";

export async function GET() {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  let headers: Record<string, string>;
  try {
    headers = opsHeaders();
  } catch (e) {
    return opsMisconfiguredResponse(e);
  }

  const res = await fetch(`${OPS_API_BASE}/portfolio`, {
    headers,
    cache: "no-store",
  });
  if (!res.ok) {
    return NextResponse.json({ error: "upstream" }, { status: res.status });
  }
  return NextResponse.json(await res.json());
}

/** Edit book-level settings (currently the inception date). */
export async function PATCH(req: NextRequest) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  let headers: Record<string, string>;
  try {
    headers = opsHeaders({ "Content-Type": "application/json" });
  } catch (e) {
    return opsMisconfiguredResponse(e);
  }

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const res = await fetch(`${OPS_API_BASE}/portfolio`, {
    method: "PATCH",
    headers,
    body: JSON.stringify(body),
    cache: "no-store",
  });
  const payload = await res.json().catch(() => ({ error: "upstream" }));
  return NextResponse.json(payload, { status: res.status });
}
