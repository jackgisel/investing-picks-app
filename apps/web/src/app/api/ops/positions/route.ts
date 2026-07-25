import { NextRequest, NextResponse } from "next/server";
import { OPS_API_BASE } from "@/lib/api-config";
import { opsHeaders, opsMisconfiguredResponse, requireAdmin } from "@/lib/admin";

export const dynamic = "force-dynamic";

/** Add a position by hand. Upstream spends cash and rejects overdrafts. */
export async function POST(req: NextRequest) {
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

  const res = await fetch(`${OPS_API_BASE}/positions`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
    cache: "no-store",
  });
  const payload = await res.json().catch(() => ({ error: "upstream" }));
  return NextResponse.json(payload, { status: res.status });
}
