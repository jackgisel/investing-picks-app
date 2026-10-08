import { cache } from "react";
import { unstable_cache } from "next/cache";

import { listPublicSampleInsights } from "@/lib/insights-db";
import { withTimeout } from "@/lib/sitemap";
import type { InsightMeta } from "@/lib/insights";

const SAMPLE_QUERY_MS = 2500;

/**
 * Nominated public sample notes. Same query SampleResearch uses, cached for
 * an hour so the root layout can ask "is there a sample?" without dynamizing
 * every page or hanging on a stuck Pool.
 */
async function loadPublicSamples(): Promise<InsightMeta[]> {
  try {
    return await withTimeout(listPublicSampleInsights(), SAMPLE_QUERY_MS, []);
  } catch {
    return [];
  }
}

export const getPublicSampleInsights = cache(
  unstable_cache(loadPublicSamples, ["public-sample-insights"], {
    revalidate: 3600,
  }),
);

export async function hasPublishedSampleResearch(): Promise<boolean> {
  const samples = await getPublicSampleInsights();
  return samples.length > 0;
}
