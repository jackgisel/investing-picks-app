import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { ensureMigrations } from "@/lib/auth";
import { sendEditorialIssue } from "@/lib/editorial-send";

export const dynamic = "force-dynamic";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;
  await ensureMigrations();
  const { id } = await params;
  const result = await sendEditorialIssue(id);
  if (!result.ok && result.sent === 0) {
    return NextResponse.json({ error: result.skipped ?? "Send failed" }, { status: 409 });
  }
  return NextResponse.json(result);
}
