import { PUBLIC_API_BASE } from "@/lib/api-config";
import type { Insight, InsightMeta } from "@/lib/insights";
import { cyclePicks } from "@/lib/insights";
import {
  claimForPublish,
  getInsightById,
  listUnsentPickNotes,
} from "@/lib/insights-db";

/**
 * Grouping a multi-pick cycle into one announcement.
 *
 * Run 118 buys one name per evaluation. On the rare day a second pick is added
 * by hand (apps/api extra_buy), each name still gets its own research note,
 * but the list should get ONE email for the cycle, not two "New pick" mails
 * minutes apart. Whichever note publishes first claims its ready siblings and
 * sends the combined mail; the auto-publisher holds a due note while a sibling
 * is still inside its review window so the pair can go out together.
 *
 * Everything here is best effort in the direction of the old behaviour: if the
 * trades lookup fails, a note announces alone, exactly as before.
 */

type TradeRow = { ticker?: string | null; action?: string | null; date?: string | null };

export async function fetchRecentTrades(): Promise<TradeRow[]> {
  try {
    const res = await fetch(`${PUBLIC_API_BASE}/trades?limit=50`, { cache: "no-store" });
    if (!res.ok) return [];
    const body = (await res.json()) as { trades?: TradeRow[] };
    return body.trades ?? [];
  } catch {
    return [];
  }
}

/** Other names bought the same day as `ticker`. Empty in a normal cycle. */
export async function fetchCyclePicks(ticker: string): Promise<string[]> {
  return cyclePicks(await fetchRecentTrades(), ticker);
}

/** Unsent pick notes for the other names in `ticker`'s cycle. */
export async function openCycleSiblings(
  ticker: string,
  trades?: TradeRow[],
): Promise<InsightMeta[]> {
  const others = cyclePicks(trades ?? (await fetchRecentTrades()), ticker);
  return listUnsentPickNotes(others);
}

/**
 * True while a sibling could still join the mail: generating, or a draft
 * still inside its review window. A draft past its deadline that the sweep
 * did not pick up is incomplete and is not waited on. The auto-publisher also
 * caps how long it holds (`MAX_CYCLE_HOLD_MS`), so a sibling stuck generating
 * cannot strand its partner.
 */
export function siblingStillComing(s: InsightMeta, now = Date.now()): boolean {
  if (s.status !== "draft") return true;
  if (!s.autoPublishAt) return true;
  return new Date(s.autoPublishAt).getTime() > now;
}

/**
 * Claim every sibling draft that is complete enough to mail. Uses the same
 * conditional UPDATE as everything else, so a sibling someone else already
 * claimed (or rejected) simply drops out.
 */
export async function claimCycleSiblings(
  siblings: InsightMeta[],
): Promise<Insight[]> {
  const claimed: Insight[] = [];
  for (const s of siblings) {
    if (s.status !== "draft") continue;
    const full = await getInsightById(s.id);
    if (!full?.title || !full.description || !full.bodyMd || !full.ticker) continue;
    const won = await claimForPublish(s.id);
    if (won) claimed.push(won);
  }
  return claimed;
}
