import { NextResponse } from "next/server";
import { PUBLIC_API_BASE } from "@/lib/api-config";
import { NO_STORE_HEADERS, requireSubscriber } from "@/lib/api-gate";

// Every company's growth, for the scatter: the members' view.
export const dynamic = "force-dynamic";

export async function GET() {
  const gate = await requireSubscriber();
  if (!gate.ok) return gate.response;

  try {
    // The screen is fixed on the API side, so there is nothing to pass.
    const res = await fetch(`${PUBLIC_API_BASE}/workforce-growth`, {
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) {
      return NextResponse.json(
        { error: "upstream" },
        { status: res.status, headers: NO_STORE_HEADERS },
      );
    }
    return NextResponse.json(await res.json(), { headers: NO_STORE_HEADERS });
  } catch {
    return NextResponse.json(
      { error: "upstream" },
      { status: 502, headers: NO_STORE_HEADERS },
    );
  }
}
