import { NextResponse } from "next/server";
import { searchEligible } from "@/lib/challenge/db";

/** Ticker and name search over the stocks an entry may hold. Public. */
export async function GET(request: Request) {
  const q = new URL(request.url).searchParams.get("q") ?? "";
  if (!q.trim() || q.length > 40) return NextResponse.json({ results: [] });
  try {
    const results = await searchEligible(q);
    return NextResponse.json(
      { results },
      { headers: { "Cache-Control": "public, max-age=300" } },
    );
  } catch (e) {
    console.error("challenge stock search failed:", e);
    return NextResponse.json({ results: [] }, { status: 503 });
  }
}
