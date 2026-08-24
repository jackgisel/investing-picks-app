import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { ensureMigrations } from "@/lib/auth";
import { getInsightById, setPublicSample } from "@/lib/insights-db";

export const dynamic = "force-dynamic";

/**
 * Nominate (or withdraw) a note as the public specimen for its post type.
 *
 * The nominated note is served unauthenticated at /research/<slug> and linked
 * from the landing page, so this is the one action in ops that makes members-
 * only research public. It is restricted to approved notes for that reason: an
 * unreviewed draft must not be one click away from the front page.
 *
 * Withdrawal is always allowed regardless of status — taking something down
 * should never be blocked by a check that only guards putting it up.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  await ensureMigrations();
  const { id } = await params;

  const body = (await req.json().catch(() => ({}))) as { on?: boolean };
  const on = body.on !== false;

  const insight = await getInsightById(id);
  if (!insight) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (on && insight.status !== "approved") {
    return NextResponse.json(
      {
        error:
          "Only an approved note can be the public sample — it would be visible to anyone.",
      },
      { status: 409 },
    );
  }

  await setPublicSample(id, on);
  return NextResponse.json({ insight: await getInsightById(id) });
}
