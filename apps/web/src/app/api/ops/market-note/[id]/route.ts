import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { ensureMigrations } from "@/lib/auth";
import {
  getIssueById,
  saveIssue,
  setConfirmed,
} from "@/lib/market-note-issue";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  await ensureMigrations();
  const { id } = await params;
  const issue = await getIssueById(id);
  if (!issue) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ issue });
}

/** Save edits and/or flip the confirmed flag. Refused once the issue is sent. */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  await ensureMigrations();
  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as {
    subject?: string;
    lede?: string | null;
    bodyMd?: string | null;
    confirmed?: boolean;
  };

  const existing = await getIssueById(id);
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (existing.sentAt) {
    return NextResponse.json(
      {
        error:
          "This issue has been mailed. There is no un-send, so it cannot be edited.",
      },
      { status: 409 },
    );
  }

  let issue = existing;
  if (body.subject !== undefined) {
    if (!body.subject.trim()) {
      return NextResponse.json(
        { error: "A subject line is required." },
        { status: 400 },
      );
    }
    const saved = await saveIssue(id, {
      subject: body.subject.trim(),
      lede: body.lede?.trim() || null,
      bodyMd: body.bodyMd?.trim() || null,
    });
    if (!saved) {
      return NextResponse.json({ error: "Could not save." }, { status: 409 });
    }
    issue = saved;
  }

  if (body.confirmed !== undefined) {
    if (body.confirmed && !issue.bodyMd?.trim()) {
      return NextResponse.json(
        { error: "Write the body before marking it ready." },
        { status: 400 },
      );
    }
    const flipped = await setConfirmed(id, body.confirmed);
    if (flipped) issue = flipped;
  }

  return NextResponse.json({ issue });
}
