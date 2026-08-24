import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { ensureMigrations } from "@/lib/auth";
import { isoWeekKey } from "@/lib/email-dispatch";
import { countActiveSubscribers } from "@/lib/market-note";
import { ensureIssue, listIssues } from "@/lib/market-note-issue";

export const dynamic = "force-dynamic";

/** The issue queue, plus how many addresses a send would reach. */
export async function GET() {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  await ensureMigrations();
  const [issues, subscribers] = await Promise.all([
    listIssues(),
    countActiveSubscribers(),
  ]);
  return NextResponse.json({ issues, subscribers, weekKey: isoWeekKey() });
}

/**
 * Start (or reopen) this week's issue.
 *
 * Keyed by ISO week, so pressing this twice in one week edits the same row
 * rather than producing a second draft nobody notices.
 */
export async function POST() {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  await ensureMigrations();
  const weekKey = isoWeekKey();
  const issue = await ensureIssue(weekKey, `Market Note — ${weekKey}`);
  return NextResponse.json({ issue });
}
