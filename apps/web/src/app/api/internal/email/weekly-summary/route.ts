import { NextResponse } from "next/server";
import { ensureMigrations } from "@/lib/auth";
import { requireInternalSecret } from "@/lib/internal-auth";
import { sendWeeklySummary } from "@/lib/weekly-summary";

export const dynamic = "force-dynamic";

/**
 * The worker's Sunday tick for the digest.
 *
 * Safe to call repeatedly: one send per ISO week is enforced by the claim in
 * `email_dispatch`, not by the schedule, so a redeploy that fires the job twice
 * mails the list once.
 */
export async function POST(req: Request) {
  const guard = requireInternalSecret(req);
  if (!guard.ok) return guard.response;

  await ensureMigrations();
  try {
    const result = await sendWeeklySummary();
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Weekly summary failed" },
      { status: 502 },
    );
  }
}
