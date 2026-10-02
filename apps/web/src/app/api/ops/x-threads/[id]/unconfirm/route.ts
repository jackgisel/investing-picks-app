import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { ensureMigrations } from "@/lib/auth";
import { unconfirmThread } from "@/lib/x-threads-db";

export const dynamic = "force-dynamic";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  await ensureMigrations();
  const { id } = await params;
  const thread = await unconfirmThread(id);
  if (!thread) {
    return NextResponse.json(
      { error: "Only an unposted draft can be changed" },
      { status: 409 },
    );
  }
  return NextResponse.json({ thread });
}
