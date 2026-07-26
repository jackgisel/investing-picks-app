import { useQuery } from "@tanstack/react-query";
import { dataQueryOptions, fetchJson } from "./api-error";

/**
 * What the strategy actually did, from `Action` in packages/strategy.
 *
 * `side` only says buy or sell. Collapsing to it makes a Winners Circle trim —
 * taking profit on a name that doubled — read exactly like a stop-out, which
 * are opposite signals about the same position.
 *
 * Null for the hand-entered positions that seeded the live book, which predate
 * the ledger; those fall back to `side`.
 */
export type TradeAction =
  | "buy"
  | "double_buy"
  | "full_sell"
  | "partial_sell"
  | "trim"
  | "recycle_trim"
  | "hold";

export interface Trade {
  ticker: string;
  side: "buy" | "sell";
  action: TradeAction | null;
  date: string;
  reason: string | null;
  evaluation_id: number | null;
}

export interface TradesResponse {
  trades: Trade[];
  count: number;
  thesis_id: number;
}

/**
 * The API caps at `limit` (its own default is 100) and returns no total, so a
 * caller that omits it gets a silently truncated list. Ask for a number we
 * choose, so the page can tell the user when it has hit the ceiling instead of
 * reporting the truncated length as the trade count.
 */
export const TRADES_LIMIT = 500;

export function useTrades(limit: number = TRADES_LIMIT) {
  return useQuery<TradesResponse>({
    queryKey: ["trades", limit],
    queryFn: () => fetchJson<TradesResponse>(`/api/data/trades?limit=${limit}`),
    ...dataQueryOptions,
  });
}
