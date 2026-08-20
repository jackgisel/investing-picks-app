import { NextResponse } from "next/server";
import { OPS_API_BASE } from "@/lib/api-config";
import { LIVE_PORTFOLIO } from "@/lib/constants";

/**
 * Public, dollar-free book metadata — currently just the inception date.
 *
 * Intentionally unauthenticated: the inception date is already published on the
 * marketing site. Only the two fields below are forwarded; the ops key never
 * leaves the server. Cached so anonymous traffic can't hammer the ops API.
 */
export const revalidate = 300;

export async function GET() {
  const fallback = {
    inception_date: LIVE_PORTFOLIO.inceptionISO,
    source: "fallback" as const,
  };

  const key = process.env.OPS_API_KEY;
  if (!key || !key.trim()) return NextResponse.json(fallback);

  try {
    const res = await fetch(`${OPS_API_BASE}/portfolio/meta`, {
      headers: { "X-Ops-Key": key },
      next: { revalidate: 300 },
    });
    if (!res.ok) return NextResponse.json(fallback);
    const data = (await res.json()) as { inception_date?: string | null };
    if (!data?.inception_date) return NextResponse.json(fallback);
    return NextResponse.json({
      inception_date: data.inception_date,
      source: "db" as const,
    });
  } catch {
    return NextResponse.json(fallback);
  }
}
