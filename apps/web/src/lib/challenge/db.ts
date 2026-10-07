import { opsHeaders } from "@/lib/admin";
import { OPS_API_BASE, PUBLIC_API_BASE } from "@/lib/api-config";

/**
 * The Beat the S&P challenge, through the API.
 *
 * Entries, the stock universe and the prices all live in the API's database
 * (`app/services/challenge.py`), because a score is a join across all three.
 * Public reads go to `/api/v1/challenge/*`. Anything tied to a user goes to
 * `/api/ops/challenge/*` with the ops key: this app signs the user in and
 * passes their id, which the API trusts only from a holder of that key.
 */

export type EligibleStock = {
  ticker: string;
  name: string | null;
  sector: string | null;
  industry: string | null;
  market_cap: number | null;
};

export type PriceBasis = "total_return" | "price" | null;

export type BoardRow = {
  id: string;
  display_name: string;
  cohort: string;
  submitted_on: string;
  /** First session, or null while the entry is waiting for its first close. */
  start_date: string | null;
  picks: number;
  ret: number | null;
  spy_ret: number | null;
  excess: number | null;
};

export type PopularPick = { ticker: string; name: string | null; entries: number };

export type Board = {
  as_of: string | null;
  basis: PriceBasis;
  cohorts: string[];
  popular: PopularPick[];
  stats: {
    entries: number;
    scored: number;
    beating: number;
    median_excess: number | null;
  };
  rows: BoardRow[];
};

export type EntryPick = EligibleStock & {
  start: number | null;
  last: number | null;
  growth: number;
};

export type SeriesPoint = { date: string; growth: number; spy: number };

export type EntryDetail = {
  id: string;
  display_name: string;
  cohort: string;
  submitted_on: string;
  start_date: string | null;
  as_of: string | null;
  basis: PriceBasis;
  picks: EntryPick[];
  spy_start: number | null;
  spy_last: number | null;
  series: SeriesPoint[];
};

export class ChallengeUnavailable extends Error {}

async function getJson<T>(url: string, init?: RequestInit & { next?: { revalidate: number } }): Promise<T | null> {
  let res: Response;
  try {
    res = await fetch(url, { signal: AbortSignal.timeout(8000), ...init });
  } catch (e) {
    throw new ChallengeUnavailable(String(e));
  }
  if (res.status === 404) return null;
  if (!res.ok) throw new ChallengeUnavailable(`${url} returned ${res.status}`);
  return (await res.json()) as T;
}

export async function searchEligible(q: string): Promise<EligibleStock[]> {
  const term = q.trim().slice(0, 40);
  if (!term) return [];
  const data = await getJson<{ results: EligibleStock[] }>(
    `${PUBLIC_API_BASE}/challenge/stocks?q=${encodeURIComponent(term)}`,
    { next: { revalidate: 3600 } },
  );
  return data?.results ?? [];
}

/** The leaderboard. Cached briefly here; the API holds its own five minute copy. */
export async function getBoard(opts: { cohort?: string | null } = {}): Promise<Board> {
  const q = opts.cohort ? `?cohort=${encodeURIComponent(opts.cohort)}` : "";
  const data = await getJson<Board>(`${PUBLIC_API_BASE}/challenge/board${q}`, {
    next: { revalidate: 120 },
  });
  if (!data) throw new ChallengeUnavailable("board missing");
  return data;
}

export async function getEntry(id: string): Promise<EntryDetail | null> {
  if (!/^[A-Za-z0-9_-]{4,16}$/.test(id)) return null;
  return getJson<EntryDetail>(`${PUBLIC_API_BASE}/challenge/entries/${encodeURIComponent(id)}`, {
    next: { revalidate: 300 },
  });
}

export type CreateResult =
  | { ok: true; id: string }
  | { ok: false; existingId: string }
  | { ok: false; error: string; tickers: string[] };

/** Lock in an entry for a signed-in user. One per user per calendar quarter. */
export async function createEntry(input: {
  userId: string;
  displayName: string;
  tickers: string[];
}): Promise<CreateResult> {
  let res: Response;
  try {
    res = await fetch(`${OPS_API_BASE}/challenge/entries`, {
      method: "POST",
      headers: opsHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({
        user_id: input.userId,
        display_name: input.displayName,
        tickers: input.tickers,
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(10000),
    });
  } catch (e) {
    throw new ChallengeUnavailable(String(e));
  }
  const data = await res.json().catch(() => ({}));
  if (res.status === 201) return { ok: true, id: data.id };
  if (res.status === 409) return { ok: false, existingId: data.existing_id };
  if (res.status === 422) {
    return { ok: false, error: data.error ?? "That entry breaks a rule.", tickers: data.tickers ?? [] };
  }
  throw new ChallengeUnavailable(`create returned ${res.status}`);
}

export type UserEntry = { id: string; cohort: string; submitted_on: string };

export async function getUserEntries(userId: string): Promise<UserEntry[]> {
  const data = await getJson<{ entries: UserEntry[] }>(
    `${OPS_API_BASE}/challenge/users/${encodeURIComponent(userId)}/entries`,
    { headers: opsHeaders(), cache: "no-store" },
  );
  return data?.entries ?? [];
}

/** Take an entry off the public board, or put it back. */
export async function setEntryHidden(id: string, hidden: boolean): Promise<boolean> {
  const res = await fetch(`${OPS_API_BASE}/challenge/entries/${encodeURIComponent(id)}/hidden`, {
    method: "POST",
    headers: opsHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ hidden }),
    cache: "no-store",
  });
  if (res.status === 404) return false;
  if (!res.ok) throw new ChallengeUnavailable(`hide returned ${res.status}`);
  return true;
}
