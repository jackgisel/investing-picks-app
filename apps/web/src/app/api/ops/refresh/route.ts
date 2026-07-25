import { NextResponse } from "next/server";
import { OPS_API_BASE } from "@/lib/api-config";
import { opsHeaders, opsMisconfiguredResponse, requireAdmin } from "@/lib/admin";

export const dynamic = "force-dynamic";

export async function POST() {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  let headers: Record<string, string>;
  try {
    headers = opsHeaders();
  } catch (e) {
    return opsMisconfiguredResponse(e);
  }

  const res = await fetch(`${OPS_API_BASE}/refresh`, {
    method: "POST",
    headers,
    cache: "no-store",
  });
  // 409 (already running) is a meaningful answer, not a proxy failure — pass the
  // upstream body through so the UI can say which it was.
  const body = await res.json().catch(() => ({ error: "upstream" }));
  return NextResponse.json(body, { status: res.status });
}
