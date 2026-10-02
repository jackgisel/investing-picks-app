import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { ensureMigrations } from "@/lib/auth";
import { countChars, estimateCostUsd, xCredentialsFromEnv } from "@/lib/x-client";
import { listThreads } from "@/lib/x-threads-db";

export const dynamic = "force-dynamic";

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
      lengths: t.posts.map(countChars),
      estimatedCostUsd: estimateCostUsd(t.posts),
    })),
  });
}
