import { NextResponse } from "next/server";
import { PUBLIC_API_BASE } from "@/lib/api-config";

// Year by year history is public: the same numbers are on every company page
// under /companies. Members keep the full board, filters and the scatter.
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ ticker: string }> },
) {
  const { ticker } = await params;
  if (!/^[A-Za-z0-9][A-Za-z0-9.-]{0,15}$/.test(ticker)) {
    return NextResponse.json({ error: "bad ticker" }, { status: 400 });
  }
  const res = await fetch(
    `${PUBLIC_API_BASE}/workforce/${encodeURIComponent(ticker)}`,
    { next: { revalidate: 3600 } },
  );
  if (!res.ok) {
    return NextResponse.json({ error: "upstream" }, { status: res.status });
  }
  return NextResponse.json(await res.json(), {
    headers: { "Cache-Control": "public, max-age=300, s-maxage=3600" },
  });
}
