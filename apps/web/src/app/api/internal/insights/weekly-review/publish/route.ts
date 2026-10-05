import { NextResponse } from "next/server";
import { requireInternalSecret } from "@/lib/internal-auth";

export const dynamic = "force-dynamic";

/** Retired. The Friday portfolio review is no longer drafted or mailed. */
export async function POST(req: Request) {
  const guard = requireInternalSecret(req);
  if (!guard.ok) return guard.response;
  return NextResponse.json({ skipped: "retired" }, { status: 410 });
}
