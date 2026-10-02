import { NextRequest, NextResponse } from "next/server";
import { OPS_API_BASE } from "@/lib/api-config";
import { opsHeaders, opsMisconfiguredResponse, requireAdmin } from "@/lib/admin";
import { ensureMigrations } from "@/lib/auth";
import { syncPickDrafts } from "@/lib/insight-sync";

export const dynamic = "force-dynamic";

/**
 * Preview or commit a one-off second pick on today's executed evaluation.
 * Body: `{ ticker, commit }`. Upstream refuses with 409 and a reason when the
 * name fails a gate, the book is short of cash, or no cycle ran today.
 */
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
  if (!body || typeof body !== "object" || typeof body.ticker !== "string") {
    return NextResponse.json({ error: "Expected { ticker, commit }" }, { status: 400 });
  }

  const res = await fetch(`${OPS_API_BASE}/extra-buy`, {
    method: "POST",
    headers,
    body: JSON.stringify({ ticker: body.ticker, commit: body.commit === true }),
    cache: "no-store",
  });
  const payload = await res.json().catch(() => ({ error: "upstream" }));

  if (res.ok && payload?.committed) {
    // Same as a hand-added position: open the note's placeholder row now and
    // leave drafting to the worker sweep. Swallowed, because the buy landed
    // and the sweep is idempotent.
    try {
      await ensureMigrations();
      await syncPickDrafts({ generate: false });
    } catch (e) {
      console.error("Could not open a draft for the second pick:", e);
    }
  }

  return NextResponse.json(payload, { status: res.status });
}
