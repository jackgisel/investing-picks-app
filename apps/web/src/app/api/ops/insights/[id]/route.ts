import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { ensureMigrations } from "@/lib/auth";
import { getInsightById, updateInsightFields } from "@/lib/insights-db";
import type { InsightDraftFields } from "@/lib/insights";

export const dynamic = "force-dynamic";

type Params = { id: string };

export async function GET(
  _req: Request,
  { params }: { params: Promise<Params> },
) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  await ensureMigrations();
  const insight = await getInsightById((await params).id);
  if (!insight) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ insight });
}

/** Admin edits to a draft. Approved notes are frozen. */
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

  const fields: Partial<InsightDraftFields> = {};
  const b = body as Record<string, unknown>;
  if (typeof b.title === "string") fields.title = b.title;
  if (typeof b.description === "string") fields.description = b.description;
  if (typeof b.lede === "string") fields.lede = b.lede;
  if (typeof b.bodyMd === "string") fields.bodyMd = b.bodyMd;
  if (typeof b.keyTakeaway === "string") fields.keyTakeaway = b.keyTakeaway;
  if (typeof b.readingTime === "number") fields.readingTime = b.readingTime;
  if (Array.isArray(b.tldr)) {
    fields.tldr = b.tldr.filter((x): x is string => typeof x === "string");
  }
  if (Array.isArray(b.tags)) {
    fields.tags = b.tags.filter((x): x is string => typeof x === "string");
  }

  await ensureMigrations();
  const { id } = await params;
  const updated = await updateInsightFields(id, fields);

  if (!updated) {
    // The row exists but the UPDATE matched nothing, which for this statement
    // means it is approved. Say so rather than returning a bare 404.
    const existing = await getInsightById(id);
    return NextResponse.json(
      {
        error: existing
          ? "This note is published. Editing it would change what subscribers were already sent."
          : "Not found",
      },
      { status: existing ? 409 : 404 },
    );
  }
  return NextResponse.json({ insight: updated });
}
