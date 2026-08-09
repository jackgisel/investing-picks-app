import { NextResponse } from "next/server";
import { ensureMigrations } from "@/lib/auth";
import { requireInternalSecret } from "@/lib/internal-auth";
import { runPerformanceAlerts } from "@/lib/performance-alerts";

export const dynamic = "force-dynamic";

/**
 * The worker's daily check for milestones and drawdowns.
 *
 * Runs after marks, so the P&L it reads is the session's. Every alert is
 * claimed by EVENT rather than by day — see `performance-alerts.ts` — so
 * calling this repeatedly cannot mail the same milestone twice.
 */
export async function POST(req: Request) {
  const guard = requireInternalSecret(req);
  if (!guard.ok) return guard.response;

  await ensureMigrations();
  try {
    const result = await runPerformanceAlerts();
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Performance alerts failed" },
      { status: 502 },
    );
  }
}
