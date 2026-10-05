import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { draftCampaign } from "@/lib/ai-drafts";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** Admin-only: research a topic and draft X copy to review. Posts and schedules nothing. */
export async function POST(req: Request) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;
  const body = (await req.json().catch(() => ({}))) as { topic?: string; thread?: boolean };
  const topic = body.topic?.trim();
  if (!topic) {
    return NextResponse.json({ error: "Give it a topic." }, { status: 400 });
  }
  try {
    return NextResponse.json(await draftCampaign(topic, Boolean(body.thread)));
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Draft failed" },
      { status: 502 },
    );
  }
}
