import { NextResponse } from "next/server";
import { OPS_API_BASE } from "@/lib/api-config";
import { opsHeaders, opsMisconfiguredResponse, requireAdmin } from "@/lib/admin";

export const dynamic = "force-dynamic";

const STEPS = new Set(["discover", "collect"]);

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ step: string }> },
) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const { step } = await params;
  if (!STEPS.has(step)) {
    return NextResponse.json({ error: "unknown step" }, { status: 404 });
  }

  let headers: Record<string, string>;
  try {
    headers = opsHeaders();
  } catch (e) {
    return opsMisconfiguredResponse(e);
  }

  const res = await fetch(`${OPS_API_BASE}/job-openings/${step}`, {
    method: "POST",
    headers,
    cache: "no-store",
  });
  // 409 (already running) is an answer, not a proxy failure.
  const body = await res.json().catch(() => ({ error: "upstream" }));
  return NextResponse.json(body, { status: res.status });
}
