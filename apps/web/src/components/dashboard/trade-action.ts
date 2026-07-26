import type { Trade } from "@/lib/hooks/use-trades";

/**
 * Colour carries the direction of the decision, not just buy vs sell:
 * green added exposure, red closed a position outright, purple took something
 * off the table while staying in the name.
 */
const ACTION_META: Record<string, { label: string; badge: string }> = {
  buy: { label: "Buy", badge: "badge-buy" },
  double_buy: { label: "Double buy", badge: "badge-buy" },
  full_sell: { label: "Full sell", badge: "badge-sell" },
  partial_sell: { label: "Partial sell", badge: "badge-hold" },
  trim: { label: "Trim", badge: "badge-hold" },
  recycle_trim: { label: "Recycle trim", badge: "badge-hold" },
  hold: { label: "Hold", badge: "badge-hold" },
};

/**
 * Hand-entered seed trades have no action; fall back to the coarse side.
 *
 * The lookup is deliberately not `(action && MAP[action]) ?? fallback`: an
 * empty-string action is falsy but not nullish, so `&&` yields `""` and `??`
 * declines to replace it — the caller then reads `.badge` off a string and
 * renders a blank cell with a broken class.
 */
export function actionMeta(trade: Pick<Trade, "action" | "side">) {
  const known = trade.action ? ACTION_META[trade.action] : undefined;
  if (known) return known;
  return {
    label: trade.side === "buy" ? "Buy" : "Sell",
    badge: trade.side === "buy" ? "badge-buy" : "badge-sell",
  };
}
