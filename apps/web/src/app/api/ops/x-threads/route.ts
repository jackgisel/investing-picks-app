import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { ensureMigrations } from "@/lib/auth";
import {
  countChars,
  estimateCostUsd,
  postingAccount,
  xCredentialsFromEnv,
  xHandleFromEnv,
} from "@/lib/x-client";
import { listThreads } from "@/lib/x-threads-db";

export const dynamic = "force-dynamic";

/** The thread queue, with the per-post character counts the editor needs. */
export async function GET() {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  await ensureMigrations();
  const threads = await listThreads();
  const credentials = xCredentialsFromEnv();
  const account = credentials ? await postingAccount(credentials) : null;

  return NextResponse.json({
    configured: credentials !== null,
    handle: xHandleFromEnv(),
    account,
    threads: threads.map((t) => ({
      ...t,
      lengths: t.posts.map(countChars),
      estimatedCostUsd: estimateCostUsd(t.posts),
    })),
  });
}
