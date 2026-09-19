import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { ensureMigrations } from "@/lib/auth";
import {
  listMembershipInvites,
  normalizeInviteEmail,
  sendMembershipInvite,
  upsertMembershipInvite,
} from "@/lib/membership-invites";

export const dynamic = "force-dynamic";

export async function GET() {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  await ensureMigrations();
  const invites = await listMembershipInvites();
  return NextResponse.json({ invites });
}

export async function POST(req: Request) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  if (!process.env.RESEND_API_KEY) {
    return NextResponse.json(
      { error: "RESEND_API_KEY is not set; refusing to send without it" },
      { status: 503 },
    );
  }

  const body = (await req.json().catch(() => ({}))) as {
    email?: unknown;
    name?: unknown;
  };
  const email = typeof body.email === "string" ? normalizeInviteEmail(body.email) : null;
  if (!email) {
    return NextResponse.json(
      { error: "A valid email is required" },
      { status: 400 },
    );
  }
  const name = typeof body.name === "string" ? body.name.trim() : "";

  await ensureMigrations();
  const invite = await upsertMembershipInvite({
    email,
    name: name || null,
    invitedBy: guard.user.email,
  });
  const sent = await sendMembershipInvite(invite);
  if (!sent.ok) {
    return NextResponse.json(
      {
        error: sent.error ?? "Invite could not be sent",
        invite,
      },
      { status: 502 },
    );
  }

  const [updated] = (await listMembershipInvites()).filter((row) => row.email === email);
  return NextResponse.json({ ok: true, invite: updated ?? invite, id: sent.id });
}
