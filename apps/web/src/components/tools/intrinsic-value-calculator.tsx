"use client";

import { useEffect, useMemo, useState } from "react";
import { intrinsicValueGrid, intrinsicValuePerShare } from "@/lib/tools/math";
import {
  formatNumber,
  formatPercentFromRatio,
  parseOptionalNumber,
} from "@/lib/tools/format";
import { useSnapshotFields } from "@/components/tools/ticker-lookup";
import {
  ResultLine,
  ToolFieldLabel,
  ToolGrid,
  toolInputClass,
} from "@/components/tools/tool-shell";

export function IntrinsicValueCalculator() {
  const { fields, pricePrefill, Ticker } = useSnapshotFields(
    "intrinsic-value-calculator",
    true,
  );
  const [price, setPrice] = useState("");
  const [fcf, setFcf] = useState("");
  const [shares, setShares] = useState("1");
  const [netDebt, setNetDebt] = useState("0");
  const [growth, setGrowth] = useState("");
  const [discount, setDiscount] = useState("");
  const [terminal, setTerminal] = useState("");

  useEffect(() => {
    const firm = fields.freeCashFlowToFirmTTM;
    if (typeof firm === "number" && Number.isFinite(firm)) {
      setFcf(String(firm));
    }
  }, [fields]);

  useEffect(() => {
    if (pricePrefill && !price) {
      setPrice(String(pricePrefill.close));
    }
  }, [pricePrefill, price]);

  const inputs = useMemo(
    () => ({
      trailingFcf: parseOptionalNumber(fcf) ?? NaN,
      shares: parseOptionalNumber(shares) ?? NaN,
      netDebt: parseOptionalNumber(netDebt) ?? 0,
      nearTermGrowthPct: parseOptionalNumber(growth) ?? NaN,
      discountRatePct: parseOptionalNumber(discount) ?? NaN,
      terminalGrowthPct: parseOptionalNumber(terminal) ?? NaN,
    }),
    [fcf, shares, netDebt, growth, discount, terminal],
  );

  const grid = useMemo(() => intrinsicValueGrid(inputs), [inputs]);
  const center = intrinsicValuePerShare(inputs);

  const revenueGrowth = fields.revenueGrowthTTM;
  const basis = fields.growthBasisPeriod;

  return (
    <ToolGrid
      inputs={
        <>
          <Ticker includePrice />
          {typeof revenueGrowth === "number" ? (
            <p className="font-sans text-[12px] text-text-dim mb-4">
              Context: revenue growth{" "}
              {formatPercentFromRatio(revenueGrowth)}
              {typeof basis === "string" ? ` (${basis})` : ""}. Not copied into
              the growth box.
            </p>
          ) : null}
          <ToolFieldLabel htmlFor="iv-price">Price ($)</ToolFieldLabel>
          <input
            id="iv-price"
            className={`${toolInputClass} mb-2`}
            value={price}
            onChange={(e) => setPrice(e.target.value)}
          />
          {pricePrefill ? (
            <p className="font-sans text-[11px] text-text-dim mb-4">
              Prefill from bar dated {pricePrefill.date} when available.
            </p>
          ) : (
            <div className="mb-4" />
          )}
          <ToolFieldLabel htmlFor="iv-fcf">
            Trailing free cash flow ($)
          </ToolFieldLabel>
          <input
            id="iv-fcf"
            className={`${toolInputClass} mb-4`}
            value={fcf}
            onChange={(e) => setFcf(e.target.value)}
          />
          <ToolFieldLabel htmlFor="iv-shares">Diluted shares</ToolFieldLabel>
          <input
            id="iv-shares"
            className={`${toolInputClass} mb-4`}
            value={shares}
            onChange={(e) => setShares(e.target.value)}
          />
          <ToolFieldLabel htmlFor="iv-debt">Net debt ($)</ToolFieldLabel>
          <input
            id="iv-debt"
            className={`${toolInputClass} mb-4`}
            value={netDebt}
            onChange={(e) => setNetDebt(e.target.value)}
          />
          <ToolFieldLabel htmlFor="iv-growth">
            Near term growth, five years (%)
          </ToolFieldLabel>
          <input
            id="iv-growth"
            className={`${toolInputClass} mb-4`}
            value={growth}
            onChange={(e) => setGrowth(e.target.value)}
          />
          <ToolFieldLabel htmlFor="iv-discount">Discount rate (%)</ToolFieldLabel>
          <input
            id="iv-discount"
            className={`${toolInputClass} mb-4`}
            value={discount}
            onChange={(e) => setDiscount(e.target.value)}
          />
          <ToolFieldLabel htmlFor="iv-terminal">Terminal growth (%)</ToolFieldLabel>
          <input
            id="iv-terminal"
            className={toolInputClass}
            value={terminal}
            onChange={(e) => setTerminal(e.target.value)}
          />
          {parseOptionalNumber(terminal) != null &&
          parseOptionalNumber(discount) != null &&
          (parseOptionalNumber(terminal) ?? 0) >=
            (parseOptionalNumber(discount) ?? 0) ? (
            <p className="font-sans text-[12px] text-accent-red mt-3">
              Terminal growth must stay below the discount rate.
            </p>
          ) : null}
        </>
      }
      result={
        <>
          <p className="font-sans text-[13px] font-bold uppercase tracking-[0.12em] text-text-dim mb-3">
            Value per share grid
          </p>
          <div className="grid grid-cols-3 gap-2 mb-6">
            {grid.map((cell) => {
              const isCenter =
                cell.growthPct === (parseOptionalNumber(growth) ?? NaN) &&
                cell.discountPct === (parseOptionalNumber(discount) ?? NaN);
              return (
                <div
                  key={`${cell.growthPct}-${cell.discountPct}`}
                  className={`rounded-soft border px-2 py-3 text-center ${
                    isCenter ? "border-border-strong bg-bg-secondary/50" : "border-border"
                  }`}
                >
                  <p className="font-sans text-[10px] text-text-dim uppercase tracking-wide">
                    G {cell.growthPct}% · R {cell.discountPct}%
                  </p>
                  <p className="font-mono text-[14px] font-semibold tabular-nums mt-1">
                    {cell.valuePerShare == null
                      ? "—"
                      : `$${formatNumber(cell.valuePerShare, 2)}`}
                  </p>
                </div>
              );
            })}
          </div>
          <ResultLine
            label="Price you entered"
            value={price.trim() ? `$${formatNumber(parseOptionalNumber(price), 2)}` : "—"}
          />
          {center != null ? (
            <p className="font-sans text-[12px] text-text-dim mt-4">
              Center cell at 5% growth and 9% discount with sample inputs reads
              132.50 in the plan illustration. Your grid uses the figures you typed.
            </p>
          ) : null}
        </>
      }
    />
  );
}
