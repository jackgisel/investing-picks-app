import { calendarDaysHeld } from "@/lib/portfolio";

/**
 * What the Open positions table should print in the rating cell.
 *
 * `quant_to_signal` maps a 1–5 score onto BUY / HOLD / SELL / STRONG SELL.
 * That is a bucket, not an order. The engine only exits an ordinary SELL
 * via hold-removal, and only after `min_holding_days`. STRONG SELL is the
 * exception: it fires immediately. A red SELL on a name we still own is how
 * a subscriber ends up selling a pick we are not selling.
 *
 * Thresholds stay unpublished. The minimum hold is already a public field —
 * it is the risk contract, not the model.
 */

export type OpenRatingKind = "rating" | "holding" | "unrated";

export interface OpenRating {
  kind: OpenRatingKind;
  label: string;
  badgeClass: string;
  title: string;
  /** Quiet second line. Only the holding case needs one. */
  detail: string | null;
}

function ratingLabel(signal: string): string {
  return signal.replaceAll("_", " ").toUpperCase();
}

function ratingBadgeClass(signal: string): string {
  if (signal === "strong_buy" || signal === "buy") return "badge-buy";
  if (signal === "hold") return "badge-hold";
  return "badge-sell";
}

function asInt(n: number | null | undefined): number | null {
  return typeof n === "number" && Number.isFinite(n) ? Math.floor(n) : null;
}

/**
 * Ordinary SELL is locked until the minimum hold is met. STRONG SELL is not.
 * Matches `signals.py`: `days_held < min_holding_days` suppresses hold-removal
 * and is skipped entirely when the entry date is unknown.
 */
export function sellLockedByMinHold(opts: {
  signal: string | null | undefined;
  entryDate: string | null | undefined;
  minHoldingDays: number | null | undefined;
  now?: Date;
}): boolean {
  if (opts.signal !== "sell") return false;
  const minDays = asInt(opts.minHoldingDays);
  if (minDays === null || minDays <= 0) return false;
  const held = calendarDaysHeld(opts.entryDate, opts.now);
  if (held === null) return false;
  return held < minDays;
}

export function describeOpenRating(opts: {
  signal: string | null | undefined;
  entryDate: string | null | undefined;
  minHoldingDays: number | null | undefined;
  ratingAsOf?: string | null;
  now?: Date;
}): OpenRating {
  const { signal } = opts;
  if (!signal) {
    return {
      kind: "unrated",
      label: "unrated",
      badgeClass: "",
      title:
        "This name has no score in the latest run, so the strategy has no rating to publish for it.",
      detail: null,
    };
  }

  if (sellLockedByMinHold(opts)) {
    const minDays = asInt(opts.minHoldingDays) ?? 0;
    const held = calendarDaysHeld(opts.entryDate, opts.now) ?? 0;
    const left = Math.max(0, minDays - held);
    const leftCopy = left === 1 ? "1 day left" : `${left} days left`;
    const asOf = opts.ratingAsOf ? ` as of ${opts.ratingAsOf}` : "";
    return {
      kind: "holding",
      label: "Holding",
      badgeClass: "badge-holding",
      title: `Rated sell${asOf}. We are not selling. Ordinary exits wait out the ${minDays}-day minimum hold. A sharp breakdown still exits immediately.`,
      detail: `Score is sell · ${leftCopy}`,
    };
  }

  return {
    kind: "rating",
    label: ratingLabel(signal),
    badgeClass: ratingBadgeClass(signal),
    title: opts.ratingAsOf
      ? `The strategy's read as of ${opts.ratingAsOf}. Ratings are re-struck each trading day, not live.`
      : "The strategy's latest read. Ratings are re-struck each trading day, not live.",
    detail: null,
  };
}
