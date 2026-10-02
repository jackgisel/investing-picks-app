import { NextResponse } from "next/server";
import { ensureMigrations } from "@/lib/auth";
import { requireInternalSecret } from "@/lib/internal-auth";
import { draftIncomeVisuals } from "@/lib/income-visual/x";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/** Called on every worker watch tick: draft any fresh print for X. */
export async function POST(req: Request) {
  const guard = requireInternalSecret(req);
  if (!guard.ok) return guard.response;

  await ensureMigrations();
  try {
    return NextResponse.json(await draftIncomeVisuals());
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Income visual drafts failed" },
      { status: 502 },
    );
  }
}
