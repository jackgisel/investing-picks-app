import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { draftCampaign } from "@/lib/ai-drafts";
import { jobStatus, startJob } from "@/lib/background-job";

export const dynamic = "force-dynamic";

const KEY = "campaign-draft";

/** Admin-only: research a topic and draft X copy to review. Posts and schedules nothing. Poll GET. */
export async function POST(req: Request) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;
  const body = (await req.json().catch(() => ({}))) as { topic?: string; thread?: boolean };
  const topic = body.topic?.trim();
  if (!topic) {
    return NextResponse.json({ error: "Give it a topic." }, { status: 400 });
  }
  const started = startJob(KEY, () => draftCampaign(topic, Boolean(body.thread)));
  return NextResponse.json({ started }, { status: 202 });
}

export async function GET() {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;
  return NextResponse.json(jobStatus(KEY));
}
