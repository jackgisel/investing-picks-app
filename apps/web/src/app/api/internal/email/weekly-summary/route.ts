import { NextResponse } from "next/server";
import { requireInternalSecret } from "@/lib/internal-auth";

export const dynamic = "force-dynamic";

/**
 * Retired. The Sunday stats digest is the Friday weekly review now.
 *
 * Left as a 410 so a worker that has not been redeployed yet fails loudly
 * instead of silently mailing the old template. The replacement is
 * POST /api/internal/insights/weekly-review/publish.
 */
export async function POST(req: Request) {
  const guard = requireInternalSecret(req);
  if (!guard.ok) return guard.response;

  return NextResponse.json(
    {
      error:
        "The Sunday weekly summary is retired. POST /api/internal/insights/weekly-review/publish instead.",
    },
    { status: 410 },
  );
}
