import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { draftMarketNoteBrief } from "@/lib/market-note-brief";

export const dynamic = "force-dynamic";

/** Admin-only bridge from the internal scoring snapshot to the editor. */
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
