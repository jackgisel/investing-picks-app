import { NextResponse } from "next/server";

const API_BASE = process.env.ETF_API_URL || "https://etf.jackgisel.com/api/v1";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const res = await fetch(`${API_BASE}/blog/${encodeURIComponent(slug)}`, {
    next: { revalidate: 3600 },
  });
  if (res.status === 404) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  const data = await res.json();
  return NextResponse.json(data);
}
