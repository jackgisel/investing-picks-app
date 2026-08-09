import { OPS_API_BASE } from "@/lib/api-config";
import { LIVE_PORTFOLIO } from "@/lib/constants";
import { daysSinceInception, isFoundersDealActive } from "@/lib/portfolio";

/** Resolve the same live-portfolio window used by the marketing UI. */
export async function isFoundersWindowActive(): Promise<boolean> {
  let inception = LIVE_PORTFOLIO.inceptionISO;
  const key = process.env.OPS_API_KEY?.trim();

  if (key) {
    try {
      const response = await fetch(`${OPS_API_BASE}/portfolio/meta`, {
        headers: { "X-Ops-Key": key },
        next: { revalidate: 300 },
      });
      if (response.ok) {
        const data = (await response.json()) as {
          inception_date?: string | null;
        };
        if (data.inception_date) inception = data.inception_date;
      }
    } catch {
      // The published fallback is preferable to making checkout unavailable.
    }
  }

  return isFoundersDealActive(daysSinceInception(inception));
}

