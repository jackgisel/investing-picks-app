import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const API_BASE = process.env.ETF_API_URL || "https://etf.jackgisel.com/api/v1";

export async function GET(request: NextRequest) {
  const limit = request.nextUrl.searchParams.get("limit") || "";
  const url = limit
    ? `${API_BASE}/trades?limit=${limit}`
    : `${API_BASE}/trades`;
  const res = await fetch(url, {
    next: { revalidate: 3600 },
  });
  const data = await res.json();
  return NextResponse.json(data);
}
