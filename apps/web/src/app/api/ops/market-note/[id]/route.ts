import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { ensureMigrations } from "@/lib/auth";
import { fetchHeldTickers } from "@/lib/held-tickers";
import {
  getIssueById,
  saveIssue,
  setConfirmed,
} from "@/lib/market-note-issue";
import {
  filledWatchlist,
  normalizeWatchlist,
  radarReady,
} from "@/lib/market-note-preview";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  await ensureMigrations();
  const { id } = await params;
  const issue = await getIssueById(id);
  if (!issue) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ issue });
}

/** Save edits and/or flip the confirmed flag. Refused once the issue is sent. */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  await ensureMigrations();
  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as {
    subject?: string;
    lede?: string | null;
    bodyMd?: string | null;
    watchlist?: unknown;
    sectorsMd?: string | null;
    sentimentMd?: string | null;
    newsMd?: string | null;
    dates?: unknown;
    confirmed?: boolean;
  };

  const existing = await getIssueById(id);
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (existing.sentAt) {
    return NextResponse.json(
      {
        error:
          "This issue has been mailed. There is no un-send, so it cannot be edited.",
      },
      { status: 409 },
    );
  }

  let issue = existing;
  const touchingContent =
    body.subject !== undefined ||
    body.lede !== undefined ||
    body.bodyMd !== undefined ||
    body.watchlist !== undefined ||
    body.sectorsMd !== undefined ||
    body.sentimentMd !== undefined ||
    body.newsMd !== undefined ||
    body.dates !== undefined;

  if (touchingContent) {
    if (body.subject !== undefined && !body.subject.trim()) {
      return NextResponse.json(
        { error: "A subject line is required." },
        { status: 400 },
      );
    }
    const watchlist =
      body.watchlist !== undefined ? body.watchlist : issue.watchlist;
    const filled = filledWatchlist(normalizeWatchlist(watchlist));
    if (filled.length > 0) {
      const held = await fetchHeldTickers();
      if (!held) {
        return NextResponse.json(
          { error: "Could not check the book, so a holding might slip onto the radar." },
          { status: 503 },
        );
      }
      const hit = filled.find((item) => held.has(item.ticker));
      if (hit) {
        return NextResponse.json(
          { error: `${hit.ticker} is in the book. The radar is names we do not hold.` },
          { status: 400 },
        );
      }
    }
    const saved = await saveIssue(id, {
      subject: (body.subject ?? issue.subject).trim(),
      lede: (body.lede ?? issue.lede)?.trim() || null,
      bodyMd: body.bodyMd !== undefined ? body.bodyMd : issue.bodyMd,
      watchlist,
      sectorsMd:
        body.sectorsMd !== undefined ? body.sectorsMd : issue.sectorsMd,
      sentimentMd:
        body.sentimentMd !== undefined ? body.sentimentMd : issue.sentimentMd,
      newsMd: body.newsMd !== undefined ? body.newsMd : issue.newsMd,
      dates: body.dates !== undefined ? body.dates : issue.dates,
    });
    if (!saved) {
      return NextResponse.json({ error: "Could not save." }, { status: 409 });
    }
    issue = saved;
  }

  if (body.confirmed !== undefined) {
    if (body.confirmed && (!radarReady(issue.watchlist) || !issue.sectorsMd?.trim())) {
      return NextResponse.json(
        {
          error:
            "The radar needs 5 to 10 names we do not hold, and a sector section, before it can be marked ready.",
        },
        { status: 400 },
      );
    }
    const flipped = await setConfirmed(id, body.confirmed);
    if (flipped) issue = flipped;
  }

  return NextResponse.json({ issue });
}
