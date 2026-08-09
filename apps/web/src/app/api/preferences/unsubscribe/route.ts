import { NextResponse } from "next/server";
import { ensureMigrations } from "@/lib/auth";
import { parseMemberList, unsubscribeFromPickAlerts } from "@/lib/pick-alerts";

/**
 * RFC 8058 one-click unsubscribe target for the member lists.
 *
 * POST only, and unauthenticated by design — mail providers issue this as a
 * POST from their own infrastructure, with no session. The human-visible footer
 * link points at /dashboard/settings instead, where the full preference set is
 * editable.
 *
 * `?list=` names which list to drop. It defaults to pick alerts, which is both
 * the original behaviour and the right fallback: every link this route has
 * already sent out omits the parameter.
 */
export async function POST(req: Request) {
  const url = new URL(req.url);
  const token = url.searchParams.get("token") ?? "";
  const list = parseMemberList(url.searchParams.get("list"));
  await ensureMigrations();
  const result = await unsubscribeFromPickAlerts(token, list);

  // Always 200. Providers retry or penalise senders on an error status, and a
  // stale token is not worth reporting to them — see the market-note route.
  return NextResponse.json({ ok: result.ok });
}
