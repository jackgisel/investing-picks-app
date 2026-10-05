import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { draftMarketNoteBrief } from "@/lib/market-note-brief";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** Admin-only: have the model draft the note from the scoring snapshot and web research. */
export async function POST() {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;
  try {
    return NextResponse.json(await draftMarketNoteBrief());
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not prepare editorial brief" },
      { status: 502 },
    );
  }
}
