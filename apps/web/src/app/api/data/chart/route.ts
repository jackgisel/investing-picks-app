import { NextResponse } from "next/server";

const API_BASE = process.env.OUTPICK_API_URL
  ? `${process.env.OUTPICK_API_URL.replace(/\/$/, "")}/api/v1`
  : (process.env.ETF_API_URL || "http://localhost:8000/api/v1");

export async function GET() {
  const res = await fetch(`${API_BASE}/chart`, {
    next: { revalidate: 3600 },
  });
  const data = await res.json();
  return NextResponse.json(data);
}
