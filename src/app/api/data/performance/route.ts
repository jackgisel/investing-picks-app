import { NextResponse } from "next/server";

const API_BASE = process.env.ETF_API_URL || "https://etf.jackgisel.com/api/v1";

export async function GET() {
  const res = await fetch(`${API_BASE}/performance`, {
    next: { revalidate: 3600 },
  });
  const data = await res.json();
  return NextResponse.json(data);
}
