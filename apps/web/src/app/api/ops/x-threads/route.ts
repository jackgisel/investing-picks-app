import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { ensureMigrations } from "@/lib/auth";
import { estimateCostUsd, xCredentialsFromEnv } from "@/lib/x-client";
import { listThreads } from "@/lib/x-threads-db";
import { postLengths, type ThreadKind } from "@/lib/x-thread-draft";
import { draftThread } from "@/lib/x-thread-sync";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const KINDS: ThreadKind[] = [
  "weekly_review",
  "market",
  "pick",
  "spotlight",
  "sunday_review",
];

/** The thread queue, with the per-post character counts the editor needs. */
export async function GET() {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  await ensureMigrations();
  const threads = await listThreads();

  return NextResponse.json({
    configured: xCredentialsFromEnv() !== null,
    handle: process.env.X_HANDLE ?? null,
    threads: threads.map((t) => ({
      ...t,
      lengths: postLengths(t.posts),
      estimatedCostUsd: estimateCostUsd(t.posts),
    })),
  });
}

/** Draft a thread by hand — the same work the scheduled job does. */
export async function POST(req: Request) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const body = (await req.json().catch(() => ({}))) as { kind?: string };
  const kind = (body.kind ?? "weekly_review") as ThreadKind;
  if (!KINDS.includes(kind)) {
    return NextResponse.json({ error: `Unknown kind ${body.kind}` }, { status: 400 });
  }

  await ensureMigrations();
  const result = await draftThread(kind);
  // 409, not 502, when the draft was refused for a missing input: the
  // operator needs to read the message, and a gateway code sends them to
  // the logs instead.
  const status = result.blocked ? 409 : result.error ? 502 : 200;
  return NextResponse.json(result, { status });
}
