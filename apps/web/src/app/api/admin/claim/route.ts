import { NextRequest, NextResponse } from "next/server";
import { ensureMigrations } from "@/lib/auth";
import { claimAdminWithToken } from "@/lib/admin";
import { getServerUser } from "@/lib/server-session";

// One-time bootstrap: promotes the signed-in user to admin when they present
// ADMIN_BOOTSTRAP_TOKEN and their email is on the ADMIN_EMAILS allowlist.
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  await ensureMigrations();

  const user = await getServerUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const token =
    body && typeof body === "object" && typeof body.token === "string"
      ? body.token
      : "";
  if (!token) {
    return NextResponse.json({ error: "Token is required" }, { status: 400 });
  }

  const result = await claimAdminWithToken(user, token);
  if (!result.ok) {
    console.warn(`[admin] Claim rejected for ${user.email}: ${result.reason}`);
    // Deliberately vague to the client — don't confirm which half was wrong.
    return NextResponse.json({ error: "Claim rejected" }, { status: 403 });
  }

  console.log(`[admin] ${user.email} claimed admin via bootstrap token`);
  return NextResponse.json({ ok: true });
}
