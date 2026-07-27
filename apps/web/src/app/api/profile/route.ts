import { NextRequest, NextResponse } from "next/server";
import { ensureMigrations } from "@/lib/auth";
import { getServerUser } from "@/lib/server-session";
import { validateDisplayName } from "@/lib/profile";
import { getDisplayName, setDisplayName } from "@/lib/profile-db";

// Reads the session cookie, so it must never be cached or prerendered.
export const dynamic = "force-dynamic";

export async function GET() {
  await ensureMigrations();
  const user = await getServerUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }
  return NextResponse.json({ display_name: await getDisplayName(user.id) });
}

export async function PATCH(req: NextRequest) {
  await ensureMigrations();
  const user = await getServerUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const payload = await req.json().catch(() => null);
  const result = validateDisplayName(
    payload && typeof payload === "object" ? payload.display_name : undefined,
  );
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  await setDisplayName(user.id, result.displayName);
  return NextResponse.json({ display_name: result.displayName });
}
