import { NextResponse } from "next/server";
import { ensureMigrations } from "@/lib/auth";
import { getServerUser } from "@/lib/server-session";
import { getSubscription } from "@/lib/subscription";

export async function GET() {
  await ensureMigrations();
  const user = await getServerUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const subscription = await getSubscription(user.id);
  return NextResponse.json({ subscription });
}
