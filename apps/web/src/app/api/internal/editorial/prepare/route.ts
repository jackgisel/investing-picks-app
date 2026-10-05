import { NextResponse } from "next/server";
import { ensureMigrations } from "@/lib/auth";
import { requireInternalSecret } from "@/lib/internal-auth";
import { prepareEditorialIssues } from "@/lib/editorial-send";

export const dynamic = "force-dynamic";
export const maxDuration = 600;

export async function POST(req: Request) {
  const guard = requireInternalSecret(req);
  if (!guard.ok) return guard.response;
  await ensureMigrations();
  try {
    return NextResponse.json(await prepareEditorialIssues());
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Editorial prepare failed" },
      { status: 502 },
    );
  }
}
