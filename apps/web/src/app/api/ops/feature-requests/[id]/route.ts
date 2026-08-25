import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { ensureMigrations } from "@/lib/auth";
import { isStatus, MAX_BODY_LENGTH } from "@/lib/feature-requests";
import { updateFeatureRequest } from "@/lib/feature-requests-db";

export const dynamic = "force-dynamic";

type Params = { id: string };

/**
 * Apply a triage decision: a status, an admin note, or both.
 *
 * Both are member-visible on their own requests page, so the note is capped
 * like any other stored text rather than trusted because an admin typed it.
 */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<Params> },
) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const b = body as Record<string, unknown>;

  // Checked here rather than left to the CHECK constraint, which would answer
  // a typo with a 500 from Postgres.
  if (b.status !== undefined && !isStatus(b.status)) {
    return NextResponse.json({ error: "Unknown status" }, { status: 400 });
  }
  if (b.adminNote !== undefined && typeof b.adminNote !== "string") {
    return NextResponse.json({ error: "Note must be text" }, { status: 400 });
  }
  const adminNote =
    typeof b.adminNote === "string" ? b.adminNote.trim() : undefined;
  if (adminNote !== undefined && adminNote.length > MAX_BODY_LENGTH) {
    return NextResponse.json(
      { error: `Note must be ${MAX_BODY_LENGTH} characters or fewer.` },
      { status: 400 },
    );
  }

  if (b.status === undefined && adminNote === undefined) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  await ensureMigrations();
  const updated = await updateFeatureRequest((await params).id, {
    status: isStatus(b.status) ? b.status : undefined,
    adminNote,
  });
  if (!updated) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ request: updated });
}
