import { NextResponse } from "next/server";
import { getAccess } from "@/lib/api-gate";
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
  // Admins have the product without a Stripe subscription. Callers that only
  // read `subscription.status` treat that account as unpaid.
  const access = await getAccess();
  return NextResponse.json({
    subscription,
    access: access.entitled ? access.via : null,
  });
}
