import { NextResponse } from "next/server";
import { ensureMigrations } from "@/lib/auth";
import { requireInternalSecret } from "@/lib/internal-auth";
import { draftThread } from "@/lib/x-thread-sync";
import type { ThreadKind } from "@/lib/x-thread-draft";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const KINDS: ThreadKind[] = [
  "weekly_review",
  "market",
  "pick",
  "spotlight",
  "sunday_review",
];

/**
 * The worker's drafting tick. Writes a thread draft and leaves it for an
 * admin. Never posts.
 *
 * Safe to call twice: an existing draft for the week is returned untouched so
 * a redeploy that re-fires the job cannot overwrite hand edits.
 */
export async function POST(req: Request) {
  const guard = requireInternalSecret(req);
  if (!guard.ok) return guard.response;

  const body = (await req.json().catch(() => ({}))) as { kind?: string };
  const kind = (body.kind ?? "weekly_review") as ThreadKind;
  if (!KINDS.includes(kind)) {
    return NextResponse.json(
      { error: `Unknown thread kind ${body.kind}; expected one of ${KINDS.join(", ")}` },
      { status: 400 },
    );
  }

  await ensureMigrations();
  const result = await draftThread(kind);
  return NextResponse.json(result, { status: result.error ? 502 : 200 });
}
