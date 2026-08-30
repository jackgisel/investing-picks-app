import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { ensureMigrations } from "@/lib/auth";
import { postThreadNow } from "@/lib/x-thread-sync";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Post a confirmed thread right now instead of waiting for the hourly tick.
 *
 * Runs the identical claim-then-post path as the scheduled job, so the button
 * cannot post something the job would have refused.
 */
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  await ensureMigrations();
  const { id } = await params;
  const result = await postThreadNow(id);
  const failed = "error" in result && result.error;
  return NextResponse.json(result, { status: failed ? 409 : 200 });
}
