import { NextResponse } from "next/server";
import { PUBLIC_API_BASE } from "@/lib/api-config";

// Public: percentage series and aggregate counts only, no identifying data.
export async function GET() {
  const res = await fetch(`${PUBLIC_API_BASE}/performance`, {
    next: { revalidate: 3600 },
  });
  if (!res.ok) {
    return NextResponse.json({ error: "upstream" }, { status: res.status });
  }
  return NextResponse.json(await res.json());
}
