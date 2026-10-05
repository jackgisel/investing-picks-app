import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { jobStatus, startJob } from "@/lib/background-job";
import { draftMarketNoteBrief } from "@/lib/market-note-brief";

export const dynamic = "force-dynamic";

const KEY = "market-note-brief";

/**
 * Admin-only: have the model draft the note from the scoring snapshot and web
 * research. That takes minutes, longer than the edge allows one request to
 * live, so this starts the job and the editor polls GET for the result.
 */
export async function POST() {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;
  const started = startJob(KEY, draftMarketNoteBrief);
  return NextResponse.json({ started }, { status: 202 });
}

export async function GET() {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;
  return NextResponse.json(jobStatus(KEY));
}
