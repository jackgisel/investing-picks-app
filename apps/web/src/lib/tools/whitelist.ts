import type { ToolId } from "./registry";

/** Whitelisted fundamentals.data keys per tool. Never expose revisions, targets, or grades. */

export const TOOL_FIELD_WHITELIST: Record<ToolId, readonly string[]> = {
  "concentrated-portfolio-calculator": [],
  "profit-margin-calculator": [
    "grossProfitMarginTTM",
    "operatingProfitMarginTTM",
    "netProfitMarginTTM",
  ],
  "free-cash-flow-worksheet": [
    "freeCashFlowYieldTTM",
    "priceToFreeCashFlowRatioTTM",
    "freeCashFlowOperatingCashFlowRatioTTM",
    "operatingCashFlowSalesRatioTTM",
    "incomeQualityTTM",
    "capexToOperatingCashFlowTTM",
    "capexToRevenueTTM",
  ],
  "downside-risk-worksheet": [
    "altmanZ",
    "debtToEquityRatioTTM",
    "interestCoverageRatioTTM",
    "currentRatioTTM",
    "netDebtToEBITDATTM",
  ],
  "intrinsic-value-calculator": [
    "freeCashFlowToFirmTTM",
    "revenueGrowthTTM",
    "growthBasisPeriod",
  ],
  "competitive-advantage-worksheet": [
    "grossProfitMarginTTM",
    "operatingProfitMarginTTM",
    "netProfitMarginTTM",
    "returnOnEquityTTM",
    "returnOnAssetsTTM",
    "returnOnCapitalEmployedTTM",
    "revenueGrowthTTM",
    "growthBasisPeriod",
  ],
};

export const TOOL_RATIO_LABELS: Record<string, string> = {
  grossProfitMarginTTM: "Gross margin",
  operatingProfitMarginTTM: "Operating margin",
  netProfitMarginTTM: "Net margin",
  returnOnEquityTTM: "Return on equity",
  returnOnAssetsTTM: "Return on assets",
  returnOnCapitalEmployedTTM: "Return on capital employed",
  revenueGrowthTTM: "Revenue growth",
  growthBasisPeriod: "Growth basis period",
  freeCashFlowYieldTTM: "Free cash flow yield",
  priceToFreeCashFlowRatioTTM: "Price to free cash flow",
  freeCashFlowOperatingCashFlowRatioTTM: "FCF to operating cash flow",
  operatingCashFlowSalesRatioTTM: "Operating cash flow to sales",
  incomeQualityTTM: "Earnings quality",
  capexToOperatingCashFlowTTM: "Capex to operating cash flow",
  capexToRevenueTTM: "Capex to revenue",
  altmanZ: "Altman Z",
  debtToEquityRatioTTM: "Debt to equity",
  interestCoverageRatioTTM: "Interest coverage",
  currentRatioTTM: "Current ratio",
  netDebtToEBITDATTM: "Net debt to EBITDA",
  freeCashFlowToFirmTTM: "Free cash flow to firm",
};

/** Keys stored as unitless ratios (0.4 = 40%). */
export const RATIO_AS_PERCENT_KEYS = new Set([
  "grossProfitMarginTTM",
  "operatingProfitMarginTTM",
  "netProfitMarginTTM",
  "returnOnEquityTTM",
  "returnOnAssetsTTM",
  "returnOnCapitalEmployedTTM",
  "revenueGrowthTTM",
  "freeCashFlowYieldTTM",
  "freeCashFlowOperatingCashFlowRatioTTM",
  "operatingCashFlowSalesRatioTTM",
  "capexToOperatingCashFlowTTM",
  "capexToRevenueTTM",
]);

export function pickWhitelistedFields(
  toolId: ToolId,
  data: Record<string, unknown>,
): Record<string, number | string | null> {
  const keys = TOOL_FIELD_WHITELIST[toolId];
  const out: Record<string, number | string | null> = {};
  for (const key of keys) {
    const raw = data[key];
    if (raw == null) {
      out[key] = null;
      continue;
    }
    if (key === "growthBasisPeriod" && typeof raw === "string") {
      out[key] = raw;
      continue;
    }
    if (typeof raw === "number" && Number.isFinite(raw)) {
      out[key] = raw;
      continue;
    }
    if (typeof raw === "string" && raw.trim()) {
      const n = Number(raw);
      out[key] = Number.isFinite(n) ? n : null;
      continue;
    }
    out[key] = null;
  }
  return out;
}
