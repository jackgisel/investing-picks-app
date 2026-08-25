import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { PUBLIC_API_BASE } from "@/lib/api-config";

// Public: percentage series and aggregate counts only, no identifying data.
export async function GET(request: NextRequest) {
  // Allowlisted, not forwarded verbatim: this value lands in a cache key and
  // an upstream URL, and the API ignores anything it does not recognise
  // anyway. Anything else is served as since-inception.
  const raw = request.nextUrl.searchParams.get("window");
  const window = ["1w", "1m", "6m", "1y"].includes(raw ?? "") ? raw : null;
  const url = window
    ? `${PUBLIC_API_BASE}/performance?window=${window}`
    : `${PUBLIC_API_BASE}/performance`;

  const res = await fetch(url, { next: { revalidate: 3600 } });
  if (!res.ok) {
    return NextResponse.json({ error: "upstream" }, { status: res.status });
  }
  return NextResponse.json(await res.json());
}
