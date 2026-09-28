"use client";

import { useMemo, useState } from "react";
import { altmanZone, portfolioLossImpact } from "@/lib/tools/math";
import {
  formatNumber,
  parseOptionalNumber,
} from "@/lib/tools/format";
import { TOOL_RATIO_LABELS } from "@/lib/tools/whitelist";
import { useSnapshotFields } from "@/components/tools/ticker-lookup";
import {
  ResultLine,
  ToolFieldLabel,
  ToolGrid,
  toolInputClass,
} from "@/components/tools/tool-shell";

const BALANCE_KEYS = [
  "altmanZ",
  "debtToEquityRatioTTM",
  "interestCoverageRatioTTM",
  "currentRatioTTM",
  "netDebtToEBITDATTM",
] as const;

function formatBalance(key: string, value: number | string | null | undefined) {
  if (value == null) return "not in the snapshot";
  if (typeof value === "number") return formatNumber(value, 2);
  return String(value);
}

export function DownsideRiskWorksheet() {
  const { fields, Ticker } = useSnapshotFields("downside-risk-worksheet");
  const [weight, setWeight] = useState("8");
  const [decline, setDecline] = useState("50");

  const impact = useMemo(
    () =>
      portfolioLossImpact({
        weightPct: parseOptionalNumber(weight) ?? NaN,
        declinePct: parseOptionalNumber(decline) ?? NaN,
      }),
    [weight, decline],
  );

  const z = fields.altmanZ as number | null | undefined;
  const zone = altmanZone(typeof z === "number" ? z : null);

  return (
    <ToolGrid
      inputs={
        <>
          <ToolFieldLabel htmlFor="dr-weight" hint="Not read from the book.">
            Position weight (% of portfolio)
          </ToolFieldLabel>
          <input
            id="dr-weight"
            className={`${toolInputClass} mb-6`}
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
          />
          <ToolFieldLabel htmlFor="dr-decline" hint="Loss you want to test.">
            Decline in that position (%)
          </ToolFieldLabel>
          <input
            id="dr-decline"
            className={toolInputClass}
            value={decline}
            onChange={(e) => setDecline(e.target.value)}
          />
        </>
      }
      result={
        <>
          <ResultLine
            label="Portfolio impact"
            value={
              impact == null
                ? "—"
                : `${formatNumber(impact, 1)} points`
            }
          />
          {impact != null ? (
            <p className="font-sans text-[14px] text-text-muted mb-6 leading-relaxed">
              An {weight}% position that falls {decline}% moves the portfolio{" "}
              {formatNumber(impact, 1)} points.
            </p>
          ) : null}

          <Ticker />
          <p className="font-sans text-[13px] font-bold uppercase tracking-[0.12em] text-text-dim mb-3 mt-4">
            Balance sheet panel
          </p>
          {BALANCE_KEYS.map((key) => (
            <ResultLine
              key={key}
              label={TOOL_RATIO_LABELS[key] ?? key}
              value={formatBalance(key, fields[key])}
            />
          ))}
          {zone ? (
            <p className="font-sans text-[12px] text-text-dim mt-4 leading-relaxed">
              {zone}. Cutoffs are Altman&apos;s, from the original Z score papers.
            </p>
          ) : null}
        </>
      }
    />
  );
}
