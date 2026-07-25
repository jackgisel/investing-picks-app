import { NextRequest, NextResponse } from "next/server";
import { OPS_API_BASE } from "@/lib/api-config";
import { opsHeaders, opsMisconfiguredResponse, requireAdmin } from "@/lib/admin";

export const dynamic = "force-dynamic";

function normalizeTicker(raw: string): string | null {
  const ticker = raw.trim().toUpperCase();
  return /^[A-Z0-9.\-]{1,16}$/.test(ticker) ? ticker : null;
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ ticker: string }> }
) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const ticker = normalizeTicker((await params).ticker);
  if (!ticker) {
    return NextResponse.json({ error: "Invalid ticker" }, { status: 400 });
  }

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

  const res = await fetch(`${OPS_API_BASE}/positions/${ticker}`, {
    method: "PATCH",
    headers,
    body: JSON.stringify(body),
    cache: "no-store",
  });
  const payload = await res.json().catch(() => ({ error: "upstream" }));
  return NextResponse.json(payload, { status: res.status });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ ticker: string }> }
) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const ticker = normalizeTicker((await params).ticker);
  if (!ticker) {
    return NextResponse.json({ error: "Invalid ticker" }, { status: 400 });
  }

  let headers: Record<string, string>;
  try {
    headers = opsHeaders();
  } catch (e) {
    return opsMisconfiguredResponse(e);
  }

  const res = await fetch(`${OPS_API_BASE}/positions/${ticker}`, {
    method: "DELETE",
    headers,
    cache: "no-store",
  });
  const payload = await res.json().catch(() => ({ error: "upstream" }));
  return NextResponse.json(payload, { status: res.status });
}
