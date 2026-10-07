import { NextResponse } from "next/server";
import { ensureMigrations } from "@/lib/auth";
import { createEntry, eligibleStocks } from "@/lib/challenge/db";
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

  await ensureMigrations();
  const tickers = normalizeTickers(body.tickers);
  const displayName = normalizeDisplayName(body.displayName);
  const eligible = new Set(
    (await eligibleStocks(tickers ?? [])).map((s) => s.ticker),
  );
  const problems = entryProblems({ tickers, displayName, eligible });
  if (problems.length > 0) {
    return NextResponse.json({ error: problems[0].message, problems }, { status: 422 });
  }

  const result = await createEntry({
    userId: user.id,
    displayName: displayName!,
    tickers: tickers!,
  });
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
