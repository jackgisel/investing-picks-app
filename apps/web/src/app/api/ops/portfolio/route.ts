import { NextResponse } from "next/server";
import { OPS_API_BASE } from "@/lib/api-config";

function opsHeaders() {
  return {
    "X-Ops-Key": process.env.OPS_API_KEY || "dev-ops-key",
  };
}

export async function GET() {
  const res = await fetch(`${OPS_API_BASE}/portfolio`, {
    headers: opsHeaders(),
    next: { revalidate: 30 },
  });
  if (!res.ok) {
    return NextResponse.json({ error: "upstream" }, { status: res.status });
  }
  return NextResponse.json(await res.json());
}
