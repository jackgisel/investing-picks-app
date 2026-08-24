import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { ensureMigrations } from "@/lib/auth";
import { getIssueById } from "@/lib/market-note-issue";
import { sendMarketNoteIssue } from "@/lib/market-note-send";

export const dynamic = "force-dynamic";

/**
 * Mail this issue to the whole free list. Irreversible.
 *
 * The gate that matters is inside `sendMarketNoteIssue` — two claims, both
 * taken before the first message leaves. This route only refuses early for the
 * cases worth a readable message.
 */
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  if (!process.env.RESEND_API_KEY) {
    return NextResponse.json(
      { error: "RESEND_API_KEY is not set; refusing to send without it" },
      { status: 503 },
    );
  }

  await ensureMigrations();
  const { id } = await params;

  const result = await sendMarketNoteIssue(id);
  if (result.skipped) {
    return NextResponse.json(
      { error: `Not sent — ${result.skipped}.`, ...result },
      { status: 409 },
    );
  }

  return NextResponse.json({ ...result, issue: await getIssueById(id) });
}
