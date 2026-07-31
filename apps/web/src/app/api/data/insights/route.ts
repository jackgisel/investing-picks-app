import { NextResponse } from "next/server";
import { ensureMigrations } from "@/lib/auth";
import { NO_STORE_HEADERS, requireSubscriber } from "@/lib/api-gate";
import { listInsights } from "@/lib/insights-db";

/**
 * Published note metadata for the dashboard's client components.
 *
 * They used to import a generated module (`lib/insight-index.ts`) that existed
 * only because importing the real one pulled every article body into their
 * bundle. Notes are rows now, so the metadata comes over the wire instead and
 * there is nothing to keep in sync.
 *
 * Subscriber-gated like the rest of /api/data: titles and descriptions are
 * member content, and the note bodies they link to are behind the same gate.
 * Bodies are never returned here — this is metadata only.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  const gate = await requireSubscriber();
  if (!gate.ok) return gate.response;

  await ensureMigrations();
  const insights = await listInsights();
  return NextResponse.json({ insights }, { headers: NO_STORE_HEADERS });
}
