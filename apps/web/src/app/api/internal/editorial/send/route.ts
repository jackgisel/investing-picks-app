import { NextResponse } from "next/server";
import { ensureMigrations } from "@/lib/auth";
import {
  analysisNominalForSend,
  analysisPeriodKey,
  isoWeekKeyFromYmd,
  pacificParts,
  ymdString,
} from "@/lib/comm-calendar";
import { requireInternalSecret } from "@/lib/internal-auth";
import { sendDueEditorial } from "@/lib/editorial-send";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** Daily 8:00 PT. Sends only when today is a Wednesday or an analysis day, and only if confirmed. */
export async function POST(req: Request) {
  const guard = requireInternalSecret(req);
  if (!guard.ok) return guard.response;
  await ensureMigrations();

  const parts = pacificParts(new Date());
  const results = [];
  if (parts.weekday === 3) {
    results.push(
      await sendDueEditorial("pick_spotlight", isoWeekKeyFromYmd(ymdString(parts))),
    );
  }
  const nominal = analysisNominalForSend(parts);
  if (nominal) {
    results.push(
      await sendDueEditorial(
        "market_analysis",
        analysisPeriodKey(parts.year, parts.month, nominal),
      ),
    );
  }
  return NextResponse.json({ results });
}
