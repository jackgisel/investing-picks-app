/** Average-down arithmetic and shareable query helpers. No I/O. */

export type Lot = { shares: number; price: number };

export type ReverseAverageReason =
  | "invalid"
  | "no_shares"
  | "price_not_below_average"
  | "target_at_or_below_price"
  | "target_not_below_average";

export type ReverseAverage =
  | { ok: true; shares: number; dollars: number }
  | { ok: false; reason: ReverseAverageReason };

export const REVERSE_MESSAGES: Record<ReverseAverageReason, string> = {
  invalid:
    "Enter the shares you hold, your average cost, a current price above 0, and a target average cost.",
  no_shares:
    "You have no shares yet. Buying at the current price sets your average cost to that price.",
  price_not_below_average:
    "The current price is not below your average cost, so buying more will not lower the average.",
  target_at_or_below_price:
    "You cannot bring your average cost down to or below the price you are paying. The new average always sits between your current average and the current price, so the target has to be above the current price.",
  target_not_below_average:
    "That target is not below your current average cost. Buying at a lower price would pull the average down, not up.",
};

export type AverageDownResult = {
  shares: number;
  avgCost: number;
  invested: number;
  price: number;
  addShares: number;
  addDollars: number;
  newShares: number;
  newAvgCost: number;
  newInvested: number;
  breakevenBeforePct: number | null;
  breakevenAfterPct: number | null;
  unrealizedPl: number | null;
  weightBeforePct: number | null;
  weightAfterPct: number | null;
  hit30BeforePts: number | null;
  hit30AfterPts: number | null;
  hit50BeforePts: number | null;
  hit50AfterPts: number | null;
};

function isPos(n: number): boolean {
  return Number.isFinite(n) && n > 0;
}

function isNonNeg(n: number): boolean {
  return Number.isFinite(n) && n >= 0;
}

function breakevenMovePct(avgCost: number, price: number): number | null {
  if (!isPos(price) || !Number.isFinite(avgCost)) return null;
  return ((avgCost - price) / price) * 100;
}

function weightHits(weightPct: number | null): {
  hit30: number | null;
  hit50: number | null;
} {
  if (weightPct == null || !Number.isFinite(weightPct)) {
    return { hit30: null, hit50: null };
  }
  return { hit30: weightPct * 0.3, hit50: weightPct * 0.5 };
}

/** Collapse valid lots into a single share count and average cost. */
export function combineLots(
  lots: ReadonlyArray<{ shares: number; price: number }>,
): { shares: number; avgCost: number; invested: number } | null {
  let shares = 0;
  let invested = 0;
  for (const lot of lots) {
    if (!isPos(lot.shares) || !isNonNeg(lot.price)) continue;
    shares += lot.shares;
    invested += lot.shares * lot.price;
  }
  if (shares <= 0) return null;
  return { shares, invested, avgCost: invested / shares };
}

/** Convert a planned add in shares or dollars into a share count. */
export function plannedAddShares(
  add: number,
  mode: "shares" | "dollars",
  price: number,
): number | null {
  if (!isNonNeg(add) || !isPos(price)) return null;
  return mode === "shares" ? add : add / price;
}

export function averageDown(input: {
  shares: number;
  avgCost: number;
  price: number;
  addShares: number;
  portfolioValue?: number | null;
}): AverageDownResult | null {
  const { shares, avgCost, price, addShares } = input;
  if (!isPos(price) || !isNonNeg(shares) || !isNonNeg(addShares)) return null;
  if (shares > 0 && !isNonNeg(avgCost)) return null;
  if (shares === 0 && addShares === 0) return null;

  const invested = shares * (shares > 0 ? avgCost : 0);
  const addDollars = addShares * price;
  const newShares = shares + addShares;
  if (newShares <= 0) return null;
  const newInvested = invested + addDollars;
  const newAvgCost = newInvested / newShares;

  const breakevenBeforePct =
    shares > 0 ? breakevenMovePct(avgCost, price) : null;
  const breakevenAfterPct = breakevenMovePct(newAvgCost, price);
  const unrealizedPl = shares > 0 ? (price - avgCost) * shares : null;

  const portfolio = input.portfolioValue;
  let weightBeforePct: number | null = null;
  let weightAfterPct: number | null = null;
  if (portfolio != null && isPos(portfolio)) {
    const mvBefore = shares * price;
    const mvAfter = newShares * price;
    weightBeforePct = (mvBefore / portfolio) * 100;
    weightAfterPct = (mvAfter / (portfolio + addDollars)) * 100;
  }

  const beforeHits = weightHits(weightBeforePct);
  const afterHits = weightHits(weightAfterPct);

  return {
    shares,
    avgCost: shares > 0 ? avgCost : newAvgCost,
    invested,
    price,
    addShares,
    addDollars,
    newShares,
    newAvgCost,
    newInvested,
    breakevenBeforePct,
    breakevenAfterPct,
    unrealizedPl,
    weightBeforePct,
    weightAfterPct,
    hit30BeforePts: beforeHits.hit30,
    hit30AfterPts: afterHits.hit30,
    hit50BeforePts: beforeHits.hit50,
    hit50AfterPts: afterHits.hit50,
  };
}

/**
 * Shares to buy at `price` so the blended average equals `targetAvg`.
 * Impossible when the target is at or below the purchase price, or when the
 * price is not below the current average.
 */
export function sharesToHitAverage(input: {
  shares: number;
  avgCost: number;
  price: number;
  targetAvg: number;
}): ReverseAverage {
  const { shares, avgCost, price, targetAvg } = input;
  if (
    !Number.isFinite(shares) ||
    !Number.isFinite(avgCost) ||
    !Number.isFinite(price) ||
    !Number.isFinite(targetAvg) ||
    !isPos(price) ||
    !isPos(targetAvg) ||
    !isNonNeg(avgCost)
  ) {
    return { ok: false, reason: "invalid" };
  }
  if (shares <= 0) return { ok: false, reason: "no_shares" };
  if (price >= avgCost) {
    return { ok: false, reason: "price_not_below_average" };
  }
  if (targetAvg <= price) {
    return { ok: false, reason: "target_at_or_below_price" };
  }
  if (targetAvg >= avgCost) {
    return { ok: false, reason: "target_not_below_average" };
  }

  const buyShares = (shares * (avgCost - targetAvg)) / (targetAvg - price);
  if (!isPos(buyShares)) return { ok: false, reason: "invalid" };
  return { ok: true, shares: buyShares, dollars: buyShares * price };
}

export type AverageDownQuery = {
  positionMode: "simple" | "lots";
  shares: string;
  avgCost: string;
  lots: { shares: string; price: string }[];
  price: string;
  addMode: "shares" | "dollars";
  add: string;
  portfolio: string;
  targetAvg: string;
};

export const AVERAGE_DOWN_DEFAULTS: AverageDownQuery = {
  positionMode: "simple",
  shares: "100",
  avgCost: "60",
  lots: [{ shares: "100", price: "60" }],
  price: "36",
  addMode: "dollars",
  add: "3000",
  portfolio: "",
  targetAvg: "",
};

export type ToolSearchParams = Record<
  string,
  string | string[] | undefined
>;

function firstParam(value: string | string[] | undefined): string {
  if (typeof value === "string") return value;
  if (Array.isArray(value) && typeof value[0] === "string") return value[0];
  return "";
}

function parseLots(raw: string): { shares: string; price: string }[] {
  const lots = raw
    .split(",")
    .map((part) => {
      const [shares, price] = part.split("x");
      if (!shares?.trim() || !price?.trim()) return null;
      return { shares: shares.trim(), price: price.trim() };
    })
    .filter((lot): lot is { shares: string; price: string } => lot != null);
  return lots.length > 0 ? lots : [{ shares: "", price: "" }];
}

export function hasAverageDownQuery(sp: ToolSearchParams | undefined): boolean {
  if (!sp) return false;
  return ["shares", "avg", "lots", "price", "add", "pv", "target", "pos", "addMode"].some(
    (key) => firstParam(sp[key]).trim().length > 0,
  );
}

export function parseAverageDownQuery(
  sp: ToolSearchParams | undefined,
): AverageDownQuery {
  const base = { ...AVERAGE_DOWN_DEFAULTS, lots: [...AVERAGE_DOWN_DEFAULTS.lots] };
  if (!hasAverageDownQuery(sp)) return base;

  const pos = firstParam(sp?.pos).trim();
  const addMode = firstParam(sp?.addMode).trim();
  const lotsRaw = firstParam(sp?.lots).trim();
  const positionMode: "simple" | "lots" =
    pos === "lots" || (pos !== "simple" && lotsRaw.length > 0) ? "lots" : "simple";

  return {
    positionMode,
    shares: firstParam(sp?.shares).trim() || (positionMode === "lots" ? "" : base.shares),
    avgCost: firstParam(sp?.avg).trim() || (positionMode === "lots" ? "" : base.avgCost),
    lots: lotsRaw ? parseLots(lotsRaw) : base.lots,
    price: firstParam(sp?.price).trim() || base.price,
    addMode: addMode === "shares" ? "shares" : "dollars",
    add: firstParam(sp?.add).trim() || base.add,
    portfolio: firstParam(sp?.pv).trim(),
    targetAvg: firstParam(sp?.target).trim(),
  };
}

export function serializeAverageDownQuery(input: AverageDownQuery): string {
  const p = new URLSearchParams();
  p.set("pos", input.positionMode);
  if (input.positionMode === "lots") {
    const lots = input.lots
      .map((lot) => `${lot.shares.trim()}x${lot.price.trim()}`)
      .filter((part) => part !== "x");
    if (lots.length) p.set("lots", lots.join(","));
  } else {
    if (input.shares.trim()) p.set("shares", input.shares.trim());
    if (input.avgCost.trim()) p.set("avg", input.avgCost.trim());
  }
  if (input.price.trim()) p.set("price", input.price.trim());
  p.set("addMode", input.addMode);
  if (input.add.trim()) p.set("add", input.add.trim());
  if (input.portfolio.trim()) p.set("pv", input.portfolio.trim());
  if (input.targetAvg.trim()) p.set("target", input.targetAvg.trim());
  return p.toString();
}
