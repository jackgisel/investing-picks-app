import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { ensureMigrations } from "@/lib/auth";
import {
  isoWeekKeyFromYmd,
  nextAnalysisSend,
  nextWednesday,
  pacificParts,
  ymdString,
} from "@/lib/comm-calendar";
import { countActiveSubscribers } from "@/lib/market-note";
import {
  ensureEditorialIssue,
  getEditorialByPeriod,
  type EditorialKind,
} from "@/lib/editorial-issue";
import { draftAnalysisIfEmpty, prepareEditorialIssues } from "@/lib/editorial-send";

export const dynamic = "force-dynamic";
export const maxDuration = 600;

function isKind(value: string | null): value is EditorialKind {
  return value === "market_analysis" || value === "pick_spotlight";
}

export async function GET(req: Request) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;
  await ensureMigrations();

  const kind = new URL(req.url).searchParams.get("kind");
  if (!isKind(kind)) {
    return NextResponse.json({ error: "Unknown letter." }, { status: 400 });
  }
  const parts = pacificParts(new Date());
  const periodKey =
    kind === "market_analysis"
      ? nextAnalysisSend(parts).periodKey
      : isoWeekKeyFromYmd(ymdString(nextWednesday(parts)));
  const [issue, subscribers] = await Promise.all([
    getEditorialByPeriod(kind, periodKey),
    countActiveSubscribers(),
  ]);
  return NextResponse.json({ issue, subscribers, periodKey });
}

export async function POST(req: Request) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;
  await ensureMigrations();
  const body = (await req.json().catch(() => ({}))) as { kind?: string };
  if (!isKind(body.kind ?? null)) {
    return NextResponse.json({ error: "Unknown letter." }, { status: 400 });
  }
  if (body.kind === "pick_spotlight") {
    const prepared = await prepareEditorialIssues();
    const failure = prepared.errors.find((e) => e.startsWith("spotlight:"));
    if (failure) return NextResponse.json({ error: failure }, { status: 502 });
    return NextResponse.json({ id: prepared.spotlightId });
  }
  const parts = pacificParts(new Date());
  const next = nextAnalysisSend(parts);
  const issue = await ensureEditorialIssue({
    kind: "market_analysis",
    periodKey: next.periodKey,
    subject: `Market analysis — ${next.periodKey}`,
  });
  try {
    await draftAnalysisIfEmpty(issue, ymdString(parts));
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Draft failed" },
      { status: 502 },
    );
  }
  return NextResponse.json({ id: issue.id });
}
