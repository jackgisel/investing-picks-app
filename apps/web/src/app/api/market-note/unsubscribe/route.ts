import { NextResponse } from "next/server";
import { ensureMigrations } from "@/lib/auth";
import { unsubscribeByToken } from "@/lib/market-note";

/**
 * RFC 8058 one-click unsubscribe target, referenced by the List-Unsubscribe
 * header on every market-note send.
 *
 * POST only. See the comment on marketNoteUnsubscribeUrl() in lib/email.ts for
 * why the human-visible link goes to a page instead of here.
 */
export async function POST(req: Request) {
  const token = new URL(req.url).searchParams.get("token") ?? "";
  await ensureMigrations();
  const result = await unsubscribeByToken(token);

  // Always 200. Mail providers retry or flag senders on an error status, and a
  // stale or already-used token is not a problem worth reporting to them — the
  // end state they asked for (this address is not subscribed) holds regardless.
  return NextResponse.json({ ok: result.ok });
}
