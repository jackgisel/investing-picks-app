import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const API_BASE = process.env.ETF_API_URL || "https://etf.jackgisel.com/api/v1";

export async function GET(request: NextRequest) {
  const type = request.nextUrl.searchParams.get("type") || "all";
  const limit = request.nextUrl.searchParams.get("limit") || "50";
  const res = await fetch(`${API_BASE}/blog?type=${type}&limit=${limit}`, {
    next: { revalidate: 3600 },
  });
  const data = await res.json();
  return NextResponse.json(data);
}
