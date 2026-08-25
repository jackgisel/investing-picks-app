import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { ensureMigrations } from "@/lib/auth";
import { listAllFeatureRequests } from "@/lib/feature-requests-db";

export const dynamic = "force-dynamic";

/** Every request, newest first. Admin-only — carries submitter emails. */
export async function GET() {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  await ensureMigrations();
  const requests = await listAllFeatureRequests();
  return NextResponse.json({ requests });
}
