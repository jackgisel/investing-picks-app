import { NextResponse } from "next/server";
import { ChallengeUnavailable, createEntry } from "@/lib/challenge/db";
import {
  entryPath,
  entryProblems,
  normalizeDisplayName,
  normalizeTickers,
} from "@/lib/challenge/rules";
import { getServerUser } from "@/lib/server-session";

/**
 * Lock in a Beat the S&P entry. Requires a signed-in account (free is fine).
 * The entry cannot be edited afterwards; that is the point of the game.
 */
export async function POST(request: Request) {
  const user = await getServerUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in to lock in your picks." }, { status: 401 });
  }
  let body: { tickers?: unknown; displayName?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  const tickers = normalizeTickers(body.tickers);
  const displayName = normalizeDisplayName(body.displayName);
  // Shape checks here; the API checks eligibility against the universe.
  const problems = entryProblems({ tickers, displayName, eligible: new Set(tickers ?? []) });
  if (problems.length > 0) {
    return NextResponse.json({ error: problems[0].message, problems }, { status: 422 });
  }

  let result;
  try {
    result = await createEntry({ userId: user.id, displayName: displayName!, tickers: tickers! });
  } catch (e) {
    if (!(e instanceof ChallengeUnavailable)) throw e;
    console.error("challenge entry failed:", e);
    return NextResponse.json(
      { error: "Could not save right now. Your picks are kept on this device; try again in a minute." },
      { status: 503 },
    );
  }
  if (!result.ok && "error" in result) {
    return NextResponse.json({ error: result.error, tickers: result.tickers }, { status: 422 });
  }
  if (!result.ok) {
    return NextResponse.json(
      {
        error: "You already have an entry this quarter. You can enter again next quarter.",
        existing: entryPath(result.existingId),
      },
      { status: 409 },
    );
  }
  return NextResponse.json({ id: result.id, href: entryPath(result.id) }, { status: 201 });
}
