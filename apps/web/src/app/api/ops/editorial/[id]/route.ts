import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { ensureMigrations } from "@/lib/auth";
import {
  getEditorialIssue,
  saveEditorialIssue,
  setEditorialConfirmed,
} from "@/lib/editorial-issue";

export const dynamic = "force-dynamic";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;
  await ensureMigrations();
  const { id } = await params;
  const existing = await getEditorialIssue(id);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (existing.sentAt) {
    return NextResponse.json({ error: "This letter has been mailed." }, { status: 409 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    subject?: string;
    bodyMd?: string;
    confirmed?: boolean;
  };
  let issue = existing;
  if (body.subject !== undefined || body.bodyMd !== undefined) {
    const subject = (body.subject ?? issue.subject).trim();
    if (!subject) {
      return NextResponse.json({ error: "A subject line is required." }, { status: 400 });
    }
    const saved = await saveEditorialIssue(id, {
      subject,
      bodyMd: body.bodyMd ?? issue.bodyMd,
      ticker: issue.ticker,
    });
    if (!saved) return NextResponse.json({ error: "Could not save." }, { status: 409 });
    issue = saved;
  }
  if (body.confirmed !== undefined) {
    if (body.confirmed && !issue.bodyMd.trim()) {
      return NextResponse.json({ error: "Write the letter before marking it ready." }, { status: 400 });
    }
    const flipped = await setEditorialConfirmed(id, body.confirmed);
    if (flipped) issue = flipped;
  }
  return NextResponse.json({ issue });
}
