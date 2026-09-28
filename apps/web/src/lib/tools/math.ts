/** Pure arithmetic for public tools. No I/O. */

export function concentratedPortfolioImpact(input: {
  count: number;
  movePct: number;
  largestWeightPct?: number | null;
}): {
  equalWeightPct: number | null;
  equalImpactPts: number | null;
  topHeavyImpactPts: number | null;
  otherWeightPct: number | null;
} {
  const n = Math.trunc(input.count);
  if (!Number.isFinite(n) || n < 1 || n > 50) {
    return {
      equalWeightPct: null,
      equalImpactPts: null,
      topHeavyImpactPts: null,
      otherWeightPct: null,
    };
  }
  if (!Number.isFinite(input.movePct)) {
    return {
      equalWeightPct: null,
      equalImpactPts: null,
      topHeavyImpactPts: null,
      otherWeightPct: null,
    };
  }

  const equalWeightPct = 100 / n;
  const equalImpactPts = (equalWeightPct / 100) * input.movePct;

  let topHeavyImpactPts: number | null = null;
  let otherWeightPct: number | null = null;
  const w = input.largestWeightPct;
  if (w != null && Number.isFinite(w) && n > 1 && w > 0 && w < 100) {
    topHeavyImpactPts = (w / 100) * input.movePct;
    otherWeightPct = (100 - w) / (n - 1);
  }

  return { equalWeightPct, equalImpactPts, topHeavyImpactPts, otherWeightPct };
}

export function profitMarginStack(input: {
  revenue: number;
  grossMarginPct: number;
  operatingMarginPct: number;
  netMarginPct: number;
  priorRevenue?: number | null;
  priorOperatingProfit?: number | null;
}): {
  grossProfit: number | null;
  operatingProfit: number | null;
  netIncome: number | null;
  grossToNetGapPts: number | null;
  incrementalOperatingMarginPct: number | null;
} {
  const { revenue } = input;
  if (!Number.isFinite(revenue) || revenue <= 0) {
    return {
      grossProfit: null,
      operatingProfit: null,
      netIncome: null,
      grossToNetGapPts: null,
      incrementalOperatingMarginPct: null,
    };
  }

  const g = input.grossMarginPct;
  const o = input.operatingMarginPct;
  const n = input.netMarginPct;

  const grossProfit = Number.isFinite(g) ? revenue * (g / 100) : null;
  const operatingProfit = Number.isFinite(o) ? revenue * (o / 100) : null;
  const netIncome = Number.isFinite(n) ? revenue * (n / 100) : null;
  const grossToNetGapPts =
    Number.isFinite(g) && Number.isFinite(n) ? g - n : null;

  let incrementalOperatingMarginPct: number | null = null;
  const pr = input.priorRevenue;
  const pop = input.priorOperatingProfit;
  if (
    pr != null &&
    pop != null &&
    Number.isFinite(pr) &&
    Number.isFinite(pop) &&
    Number.isFinite(o) &&
    revenue !== pr
  ) {
    const currentOp = revenue * (o / 100);
    incrementalOperatingMarginPct =
      ((currentOp - pop) / (revenue - pr)) * 100;
  }

  return {
    grossProfit,
    operatingProfit,
    netIncome,
    grossToNetGapPts,
    incrementalOperatingMarginPct,
  };
}

export function ownerEarnings(input: {
  reportedFcf: number;
  sbcAddBack: number;
  maintenanceCapex: number;
  price?: number | null;
  shares?: number | null;
}): {
  ownerEarnings: number | null;
  yieldOnTypedPct: number | null;
} {
  const { reportedFcf, sbcAddBack, maintenanceCapex } = input;
  if (
    !Number.isFinite(reportedFcf) ||
    !Number.isFinite(sbcAddBack) ||
    !Number.isFinite(maintenanceCapex)
  ) {
    return { ownerEarnings: null, yieldOnTypedPct: null };
  }
  const owner = reportedFcf + sbcAddBack - maintenanceCapex;
  const price = input.price;
  const shares = input.shares;
  let yieldOnTypedPct: number | null = null;
  if (
    price != null &&
    shares != null &&
    Number.isFinite(price) &&
    Number.isFinite(shares) &&
    price > 0 &&
    shares > 0
  ) {
    yieldOnTypedPct = (owner / (price * shares)) * 100;
  }
  return { ownerEarnings: owner, yieldOnTypedPct };
}

export function portfolioLossImpact(input: {
  weightPct: number;
  declinePct: number;
}): number | null {
  const { weightPct, declinePct } = input;
  if (!Number.isFinite(weightPct) || !Number.isFinite(declinePct)) return null;
  return (weightPct / 100) * declinePct;
}

export function altmanZone(z: number | null | undefined): string | null {
  if (z == null || !Number.isFinite(z)) return null;
  if (z > 2.99) return "Above 2.99 (Altman's safe zone)";
  if (z >= 1.81) return "1.81 to 2.99 (Altman's grey zone)";
  return "Below 1.81 (Altman's distress zone)";
}

export function intrinsicValuePerShare(input: {
  trailingFcf: number;
  shares: number;
  netDebt: number;
  nearTermGrowthPct: number;
  discountRatePct: number;
  terminalGrowthPct: number;
}): number | null {
  const g = input.nearTermGrowthPct / 100;
  const r = input.discountRatePct / 100;
  const tg = input.terminalGrowthPct / 100;
  const { trailingFcf, shares, netDebt } = input;

  if (
    !Number.isFinite(trailingFcf) ||
    !Number.isFinite(shares) ||
    !Number.isFinite(netDebt) ||
    shares <= 0 ||
    !Number.isFinite(g) ||
    !Number.isFinite(r) ||
    !Number.isFinite(tg) ||
    r <= 0 ||
    tg >= r
  ) {
    return null;
  }

  let pv = 0;
  let fcf = trailingFcf;
  for (let year = 1; year <= 5; year += 1) {
    fcf *= 1 + g;
    pv += fcf / (1 + r) ** year;
  }
  const terminalFcf = fcf * (1 + tg);
  const terminalValue = terminalFcf / (r - tg);
  const pvTerminal = terminalValue / (1 + r) ** 5;
  const equity = pv + pvTerminal - netDebt;
  return equity / shares;
}

export type IntrinsicGridCell = {
  growthPct: number;
  discountPct: number;
  valuePerShare: number | null;
};

/** 3×3 sensitivity grid stepping growth ±2 pts and discount ±1 pt from center. */
export function intrinsicValueGrid(input: {
  trailingFcf: number;
  shares: number;
  netDebt: number;
  nearTermGrowthPct: number;
  discountRatePct: number;
  terminalGrowthPct: number;
}): IntrinsicGridCell[] {
  const { nearTermGrowthPct, discountRatePct } = input;
  const cells: IntrinsicGridCell[] = [];
  for (const gOff of [-2, 0, 2]) {
    for (const rOff of [-1, 0, 1]) {
      const growthPct = nearTermGrowthPct + gOff;
      const discountPct = discountRatePct + rOff;
      cells.push({
        growthPct,
        discountPct,
        valuePerShare: intrinsicValuePerShare({
          ...input,
          nearTermGrowthPct: growthPct,
          discountRatePct: discountPct,
        }),
      });
    }
  }
  return cells;
}
