import { NextRequest, NextResponse } from "next/server";
import { OPS_API_BASE } from "@/lib/api-config";
import { opsHeaders, opsMisconfiguredResponse, requireAdmin } from "@/lib/admin";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const { id } = await params;
  if (!/^\d+$/.test(id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  let headers: Record<string, string>;
  try {
    headers = opsHeaders();
  } catch (e) {
    return opsMisconfiguredResponse(e);
  }

  const res = await fetch(`${OPS_API_BASE}/evaluations/${id}`, {
    headers,
    cache: "no-store",
  });
  if (!res.ok) {
    return NextResponse.json({ error: "upstream" }, { status: res.status });
  }
  return NextResponse.json(await res.json());
}
