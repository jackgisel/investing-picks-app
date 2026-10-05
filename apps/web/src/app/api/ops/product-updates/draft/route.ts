import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { draftProductUpdate } from "@/lib/ai-drafts";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/** Admin-only: turn rough notes into a subject and body for the editor. Saves nothing. */
export async function POST(req: Request) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;
  const body = (await req.json().catch(() => ({}))) as { notes?: string };
  const notes = body.notes?.trim();
  if (!notes) {
    return NextResponse.json({ error: "Add a few notes on what changed." }, { status: 400 });
  }
  try {
    return NextResponse.json(await draftProductUpdate(notes));
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Draft failed" },
      { status: 502 },
    );
  }
}
