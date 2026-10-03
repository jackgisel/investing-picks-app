import { NextResponse } from "next/server";
import { PUBLIC_API_BASE } from "@/lib/api-config";
import { NO_STORE_HEADERS, requireSubscriber } from "@/lib/api-gate";

// History and charts are the members' view of the workforce data.
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ ticker: string }> },
) {
  const gate = await requireSubscriber();
  if (!gate.ok) return gate.response;

  const { ticker } = await params;
  if (!/^[A-Za-z0-9][A-Za-z0-9.-]{0,15}$/.test(ticker)) {
    return NextResponse.json({ error: "bad ticker" }, { status: 400 });
  }
  const res = await fetch(
    `${PUBLIC_API_BASE}/workforce/${encodeURIComponent(ticker)}`,
    { cache: "no-store" },
  );
  if (!res.ok) {
    return NextResponse.json({ error: "upstream" }, { status: res.status });
  }
  return NextResponse.json(await res.json(), { headers: NO_STORE_HEADERS });
}
