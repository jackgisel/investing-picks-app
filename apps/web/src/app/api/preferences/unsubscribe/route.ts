import { NextResponse } from "next/server";
import { ensureMigrations } from "@/lib/auth";
import { unsubscribeFromPickAlerts } from "@/lib/pick-alerts";

/**
 * RFC 8058 one-click unsubscribe target for pick alerts.
 *
 * POST only, and unauthenticated by design — mail providers issue this as a
 * POST from their own infrastructure, with no session. The human-visible footer
 * link points at /dashboard/settings instead, where the full preference set is
 * editable.
 */
export async function POST(req: Request) {
  const token = new URL(req.url).searchParams.get("token") ?? "";
  await ensureMigrations();
  const result = await unsubscribeFromPickAlerts(token);

  // Always 200. Providers retry or penalise senders on an error status, and a
  // stale token is not worth reporting to them — see the market-note route.
  return NextResponse.json({ ok: result.ok });
}
