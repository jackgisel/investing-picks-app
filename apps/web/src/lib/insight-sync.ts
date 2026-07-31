import { PUBLIC_API_BASE } from "@/lib/api-config";
import { fetchResearchFacts, generateDraft } from "@/lib/insight-draft";
import {
  createPendingInsight,
  listPendingInsights,
  markGenerationFailed,
  saveDraft,
} from "@/lib/insights-db";
import { pickSlug } from "@/lib/insights";

/**
 * Reconciliation: every open pick should have a note, and every note that has
 * no body yet should get one drafted.
 *
 * Deliberately a sweep rather than a push. A push-only design drops a pick
 * silently whenever the notification fails — the worker was down, the deploy
 * was mid-restart, the request timed out — and nothing afterwards notices. A
 * sweep is idempotent, self-healing, and safe to run on a loop, so the pushes
 * that do exist are latency optimisations rather than the thing correctness
 * rests on.
 *
 * Nothing here publishes or emails. It produces drafts for a human to review.
 */

type ApiPick = {
  ticker?: string;
  status?: string;
  entry_date?: string | null;
};

export type SyncResult = {
  created: string[];
  generated: string[];
  failed: { ticker: string; error: string }[];
  skipped: number;
};

async function activePicks(): Promise<ApiPick[]> {
  const res = await fetch(`${PUBLIC_API_BASE}/picks?status=active`, {
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Could not list picks (upstream ${res.status})`);
  }
  const body = (await res.json()) as { picks?: ApiPick[] };
  return (body.picks ?? []).filter((p) => p.ticker);
}

/**
 * @param generate  Whether to spend Claude calls filling in pending bodies.
 *   The ops position-create proxy passes false — it fires this inline on a
 *   request a human is waiting on, and creating the row is the part that has
 *   to happen promptly. The worker passes true.
 */
export async function syncPickDrafts(
  { generate = true }: { generate?: boolean } = {},
): Promise<SyncResult> {
  const result: SyncResult = {
    created: [],
    generated: [],
    failed: [],
    skipped: 0,
  };

  for (const pick of await activePicks()) {
    const ticker = pick.ticker!.toUpperCase();
    // A placeholder slug: the real one is derived from the generated title,
    // but the row has to exist before there is a title to derive it from.
    const created = await createPendingInsight(ticker, `${ticker.toLowerCase()}-pending`);
    if (created) result.created.push(ticker);
    else result.skipped += 1;
  }

  if (!generate) return result;

  // Sequential on purpose. These are long, expensive calls and the caller is
  // a scheduled job, not a person — running them in parallel buys nothing and
  // risks tripping rate limits mid-sweep.
  for (const pending of await listPendingInsights()) {
    if (!pending.ticker) continue;
    try {
      const facts = await fetchResearchFacts(pending.ticker);
      const draft = await generateDraft(facts);
      await saveDraft(pending.id, draft, facts, pickSlug(pending.ticker, draft.title));
      result.generated.push(pending.ticker);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      // Record it against the row rather than throwing. One ticker that fails
      // to draft must not abandon the rest of the sweep, and a row left in
      // `pending` is invisible — `failed` shows up in the review queue.
      await markGenerationFailed(pending.id, message);
      result.failed.push({ ticker: pending.ticker, error: message });
    }
  }

  return result;
}

/** Regenerate one note, whatever state it is in (short of approved). */
export async function regenerateInsight(
  id: string,
  ticker: string,
): Promise<void> {
  try {
    const facts = await fetchResearchFacts(ticker);
    const draft = await generateDraft(facts);
    const saved = await saveDraft(id, draft, facts, pickSlug(ticker, draft.title));
    if (!saved) {
      throw new Error("Note is approved; regenerating would rewrite what was mailed");
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await markGenerationFailed(id, message);
    throw e;
  }
}
