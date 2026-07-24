import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const API_BASE = process.env.OUTPICK_API_URL
  ? `${process.env.OUTPICK_API_URL.replace(/\/$/, "")}/api/v1`
  : (process.env.ETF_API_URL || "http://localhost:8000/api/v1");

export async function GET(request: NextRequest) {
  const status = request.nextUrl.searchParams.get("status") || "active";
  const res = await fetch(`${API_BASE}/picks?status=${status}`, {
    next: { revalidate: 3600 },
  });
  const data = await res.json();
  return NextResponse.json(data);
}
