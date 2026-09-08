import { anonymiseStrategy } from "@/lib/api-gate";
import { PUBLIC_API_BASE } from "@/lib/api-config";
import type { StrategyData } from "@/lib/hooks/use-strategy";

/**
 * The same anonymised strategy payload the marketing site's client fetch
 * receives from `/api/data/strategy`.
 *
 * Track record is a public page. If this number only existed after hydration,
 * crawlers and anyone whose JS had not run yet saw "Live return —" next to a
 * fully rendered simulated +250% — which reads as a broken dash, not as
 * "loading". Fetching on the server puts the real picks return in the HTML.
 *
 * Returns null when upstream is down or the body is unusable. Callers must
 * render an honest empty state, never a fabricated percentage.
 */
export async function getPublicStrategy(): Promise<StrategyData | null> {
  try {
    const res = await fetch(`${PUBLIC_API_BASE}/strategy`, {
      next: { revalidate: 300 },
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) return null;
    const data: unknown = await res.json();
    if (!data || typeof data !== "object") return null;
    return anonymiseStrategy(data as Record<string, unknown>) as unknown as StrategyData;
  } catch {
    return null;
  }
}
