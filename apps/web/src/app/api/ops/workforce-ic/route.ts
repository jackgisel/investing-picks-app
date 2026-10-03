import { NextResponse } from "next/server";
import { OPS_API_BASE } from "@/lib/api-config";
import { opsHeaders, opsMisconfiguredResponse, requireAdmin } from "@/lib/admin";

export const dynamic = "force-dynamic";

async function proxy(method: "GET" | "POST") {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  let headers: Record<string, string>;
  try {
    headers = opsHeaders();
  } catch (e) {
    return opsMisconfiguredResponse(e);
  }

  const res = await fetch(`${OPS_API_BASE}/workforce-ic`, {
    method,
    headers,
    cache: "no-store",
  });
  // 409 (already running) is an answer, not a proxy failure.
  const body = await res.json().catch(() => ({ error: "upstream" }));
  return NextResponse.json(body, { status: res.status });
}

export async function GET() {
  return proxy("GET");
}

export async function POST() {
  return proxy("POST");
}
