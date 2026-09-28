"use client";

import { useEffect, useMemo, useState } from "react";
import { profitMarginStack } from "@/lib/tools/math";
import {
  formatNumber,
  formatPercentTyped,
  parseOptionalNumber,
  ratioToMarginPercent,
} from "@/lib/tools/format";
import { useSnapshotFields } from "@/components/tools/ticker-lookup";
import {
  ResultLine,
  ToolFieldLabel,
  ToolGrid,
  toolInputClass,
} from "@/components/tools/tool-shell";

export function ProfitMarginCalculator() {
  const { fields, Ticker } = useSnapshotFields("profit-margin-calculator");
  const [revenue, setRevenue] = useState("100");
  const [gross, setGross] = useState("60");
  const [operating, setOperating] = useState("25");
  const [net, setNet] = useState("18");
  const [priorRev, setPriorRev] = useState("");
  const [priorOp, setPriorOp] = useState("");

  useEffect(() => {
    const g = ratioToMarginPercent(fields.grossProfitMarginTTM as number | null);
    const o = ratioToMarginPercent(
      fields.operatingProfitMarginTTM as number | null,
    );
    const n = ratioToMarginPercent(fields.netProfitMarginTTM as number | null);
    if (g != null) setGross(g.toFixed(2));
    if (o != null) setOperating(o.toFixed(2));
    if (n != null) setNet(n.toFixed(2));
  }, [fields]);

  const stack = useMemo(
    () =>
      profitMarginStack({
        revenue: parseOptionalNumber(revenue) ?? NaN,
        grossMarginPct: parseOptionalNumber(gross) ?? NaN,
        operatingMarginPct: parseOptionalNumber(operating) ?? NaN,
        netMarginPct: parseOptionalNumber(net) ?? NaN,
        priorRevenue: parseOptionalNumber(priorRev),
        priorOperatingProfit: parseOptionalNumber(priorOp),
      }),
    [revenue, gross, operating, net, priorRev, priorOp],
  );

  const fromSnap =
    fields.grossProfitMarginTTM != null ||
    fields.operatingProfitMarginTTM != null ||
    fields.netProfitMarginTTM != null;

  return (
    <ToolGrid
      inputs={
        <>
          <Ticker />
          {fromSnap ? (
            <p className="font-sans text-[12px] text-text-dim mb-4">
              Margins marked from the snapshot can be overwritten.
            </p>
          ) : null}
          <ToolFieldLabel htmlFor="pm-revenue">Revenue ($)</ToolFieldLabel>
          <input
            id="pm-revenue"
            className={`${toolInputClass} mb-6`}
            inputMode="decimal"
            value={revenue}
            onChange={(e) => setRevenue(e.target.value)}
          />
          <ToolFieldLabel htmlFor="pm-gross">Gross margin (%)</ToolFieldLabel>
          <input
            id="pm-gross"
            className={`${toolInputClass} mb-6`}
            value={gross}
            onChange={(e) => setGross(e.target.value)}
          />
          <ToolFieldLabel htmlFor="pm-op">Operating margin (%)</ToolFieldLabel>
          <input
            id="pm-op"
            className={`${toolInputClass} mb-6`}
            value={operating}
            onChange={(e) => setOperating(e.target.value)}
          />
          <ToolFieldLabel htmlFor="pm-net">Net margin (%)</ToolFieldLabel>
          <input
            id="pm-net"
            className={`${toolInputClass} mb-6`}
            value={net}
            onChange={(e) => setNet(e.target.value)}
          />
          <ToolFieldLabel htmlFor="pm-prior-rev" hint="Optional incremental line.">
            Prior year revenue ($)
          </ToolFieldLabel>
          <input
            id="pm-prior-rev"
            className={`${toolInputClass} mb-4`}
            value={priorRev}
            onChange={(e) => setPriorRev(e.target.value)}
          />
          <ToolFieldLabel htmlFor="pm-prior-op">
            Prior year operating profit ($)
          </ToolFieldLabel>
          <input
            id="pm-prior-op"
            className={toolInputClass}
            value={priorOp}
            onChange={(e) => setPriorOp(e.target.value)}
          />
        </>
      }
      result={
        <>
          <ResultLine
            label="Gross profit"
            value={
              stack.grossProfit == null
                ? "—"
                : `$${formatNumber(stack.grossProfit, 2)}`
            }
          />
          <ResultLine
            label="Operating profit"
            value={
              stack.operatingProfit == null
                ? "—"
                : `$${formatNumber(stack.operatingProfit, 2)}`
            }
          />
          <ResultLine
            label="Net income"
            value={
              stack.netIncome == null
                ? "—"
                : `$${formatNumber(stack.netIncome, 2)}`
            }
          />
          <ResultLine
            label="Gap gross to net"
            value={
              stack.grossToNetGapPts == null
                ? "—"
                : `${formatNumber(stack.grossToNetGapPts, 1)} pts`
            }
          />
          {stack.incrementalOperatingMarginPct != null ? (
            <ResultLine
              label="Incremental operating margin"
              value={formatPercentTyped(stack.incrementalOperatingMarginPct, 2)}
            />
          ) : null}
        </>
      }
    />
  );
}
