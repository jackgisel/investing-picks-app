import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { setEntryHidden } from "@/lib/challenge/db";

/**
 * Hide a challenge entry from the public board (or show it again), e.g. for
 * an abusive display name. Body: `{ "hidden": true }`.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;
  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as { hidden?: unknown };
  if (typeof body.hidden !== "boolean") {
    return NextResponse.json({ error: "hidden must be true or false" }, { status: 400 });
  }
  const found = await setEntryHidden(id, body.hidden);
  return found
    ? NextResponse.json({ id, hidden: body.hidden })
    : NextResponse.json({ error: "Not found" }, { status: 404 });
}
