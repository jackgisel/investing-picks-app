import { NextRequest, NextResponse } from "next/server";
import { OPS_API_BASE } from "@/lib/api-config";
import { opsHeaders, opsMisconfiguredResponse, requireAdmin } from "@/lib/admin";
import { ensureMigrations } from "@/lib/auth";
import { syncPickDrafts } from "@/lib/insight-sync";

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

  if (res.ok) {
    // Open the research note's placeholder row immediately, so a pick added by
    // hand shows up in the review queue rather than waiting for the next
    // scheduled sweep. Drafting is left to the worker — a model call takes
    // minutes and this request has a human waiting on it.
    //
    // Failure here is swallowed on purpose. The position was created; failing
    // the response would tell the admin their entry did not work, and the
    // sweep is idempotent and will pick it up anyway.
    try {
      await ensureMigrations();
      await syncPickDrafts({ generate: false });
    } catch (e) {
      console.error("Could not open a draft for the new position:", e);
    }
  }

  return NextResponse.json(payload, { status: res.status });
}
