"use client";

import { useEffect, useMemo, useState } from "react";
import { ownerEarnings } from "@/lib/tools/math";
import {
  formatNumber,
  formatPercentFromRatio,
  formatPercentTyped,
  parseOptionalNumber,
} from "@/lib/tools/format";
import {
  RATIO_AS_PERCENT_KEYS,
  TOOL_RATIO_LABELS,
} from "@/lib/tools/whitelist";
import { useSnapshotFields } from "@/components/tools/ticker-lookup";
import {
  ResultLine,
  ToolFieldLabel,
  ToolGrid,
  toolInputClass,
} from "@/components/tools/tool-shell";

const RATIO_KEYS = [
  "freeCashFlowYieldTTM",
  "priceToFreeCashFlowRatioTTM",
  "freeCashFlowOperatingCashFlowRatioTTM",
  "operatingCashFlowSalesRatioTTM",
  "incomeQualityTTM",
  "capexToOperatingCashFlowTTM",
  "capexToRevenueTTM",
] as const;

function formatField(key: string, value: number | string | null | undefined) {
  if (value == null) return "not in the snapshot";
  if (key === "growthBasisPeriod") return String(value);
  if (typeof value === "number" && RATIO_AS_PERCENT_KEYS.has(key)) {
    return formatPercentFromRatio(value);
  }
  if (typeof value === "number") return formatNumber(value, 2);
  return String(value);
}

export function FreeCashFlowWorksheet() {
  const { fields, Ticker } = useSnapshotFields("free-cash-flow-worksheet");
  const [reported, setReported] = useState("100");
  const [sbc, setSbc] = useState("15");
  const [capex, setCapex] = useState("20");
  const [price, setPrice] = useState("");
  const [shares, setShares] = useState("");

  const oe = useMemo(
    () =>
      ownerEarnings({
        reportedFcf: parseOptionalNumber(reported) ?? NaN,
        sbcAddBack: parseOptionalNumber(sbc) ?? NaN,
        maintenanceCapex: parseOptionalNumber(capex) ?? NaN,
        price: parseOptionalNumber(price),
        shares: parseOptionalNumber(shares),
      }),
    [reported, sbc, capex, price, shares],
  );

  return (
    <ToolGrid
      inputs={
        <>
          <Ticker />
          <p className="font-sans text-[13px] font-bold uppercase tracking-[0.12em] text-text-dim mb-3">
            Ratio panel
          </p>
          {RATIO_KEYS.map((key) => (
            <ResultLine
              key={key}
              label={TOOL_RATIO_LABELS[key] ?? key}
              value={formatField(key, fields[key])}
              mono={fields[key] != null}
            />
          ))}

          <p className="font-sans text-[13px] font-bold uppercase tracking-[0.12em] text-text-dim mt-8 mb-3">
            Owner earnings (typed)
          </p>
          <ToolFieldLabel htmlFor="fcf-reported">
            Reported free cash flow ($)
          </ToolFieldLabel>
          <input
            id="fcf-reported"
            className={`${toolInputClass} mb-4`}
            value={reported}
            onChange={(e) => setReported(e.target.value)}
          />
          <ToolFieldLabel htmlFor="fcf-sbc">
            Stock based compensation add back ($)
          </ToolFieldLabel>
          <input
            id="fcf-sbc"
            className={`${toolInputClass} mb-4`}
            value={sbc}
            onChange={(e) => setSbc(e.target.value)}
          />
          <ToolFieldLabel htmlFor="fcf-capex">
            Maintenance capex subtract ($)
          </ToolFieldLabel>
          <input
            id="fcf-capex"
            className={`${toolInputClass} mb-4`}
            value={capex}
            onChange={(e) => setCapex(e.target.value)}
          />
          <ToolFieldLabel htmlFor="fcf-price">Price ($)</ToolFieldLabel>
          <input
            id="fcf-price"
            className={`${toolInputClass} mb-4`}
            value={price}
            onChange={(e) => setPrice(e.target.value)}
          />
          <ToolFieldLabel htmlFor="fcf-shares">Diluted shares</ToolFieldLabel>
          <input
            id="fcf-shares"
            className={toolInputClass}
            value={shares}
            onChange={(e) => setShares(e.target.value)}
          />
        </>
      }
      result={
        <>
          <ResultLine
            label="Owner earnings"
            value={
              oe.ownerEarnings == null
                ? "—"
                : `$${formatNumber(oe.ownerEarnings, 2)}`
            }
          />
          <ResultLine
            label="Owner earnings yield (on the numbers you typed)"
            value={
              oe.yieldOnTypedPct == null
                ? "Fill price and shares to show yield"
                : formatPercentTyped(oe.yieldOnTypedPct, 2)
            }
          />
          <p className="font-sans text-[12px] text-text-dim mt-6 leading-relaxed">
            Sample keystrokes: reported 100, SBC 15, maintenance capex 20 gives
            owner earnings 95. Not a company filing.
          </p>
        </>
      }
    />
  );
}
