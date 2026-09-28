"use client";

import { useMemo, useState } from "react";
import { concentratedPortfolioImpact } from "@/lib/tools/math";
import { formatNumber, formatPercentTyped, parseOptionalNumber } from "@/lib/tools/format";
import {
  ResultLine,
  ToolFieldLabel,
  ToolGrid,
  toolInputClass,
} from "@/components/tools/tool-shell";

export function ConcentratedPortfolioCalculator() {
  const [count, setCount] = useState("10");
  const [move, setMove] = useState("-50");
  const [topHeavy, setTopHeavy] = useState(false);
  const [largest, setLargest] = useState("25");

  const result = useMemo(() => {
    return concentratedPortfolioImpact({
      count: parseOptionalNumber(count) ?? NaN,
      movePct: parseOptionalNumber(move) ?? NaN,
      largestWeightPct: topHeavy ? parseOptionalNumber(largest) : null,
    });
  }, [count, move, topHeavy, largest]);

  return (
    <ToolGrid
      inputs={
        <>
          <ToolFieldLabel htmlFor="cp-count" hint="Integer from 1 to 50.">
            Number of stocks
          </ToolFieldLabel>
          <input
            id="cp-count"
            className={`${toolInputClass} mb-6`}
            inputMode="numeric"
            value={count}
            onChange={(e) => setCount(e.target.value)}
          />

          <ToolFieldLabel htmlFor="cp-move" hint="Loss or gain you want to test.">
            Move in one name (%)
          </ToolFieldLabel>
          <input
            id="cp-move"
            className={`${toolInputClass} mb-6`}
            inputMode="decimal"
            value={move}
            onChange={(e) => setMove(e.target.value)}
          />

          <label className="flex items-center gap-3 font-sans text-[14px] text-text-muted mb-4 cursor-pointer">
            <input
              type="checkbox"
              checked={topHeavy}
              onChange={(e) => setTopHeavy(e.target.checked)}
              className="h-4 w-4 rounded border-border-strong"
            />
            Top heavy mode (largest weight typed)
          </label>

          {topHeavy ? (
            <>
              <ToolFieldLabel htmlFor="cp-largest">
                Largest position weight (%)
              </ToolFieldLabel>
              <input
                id="cp-largest"
                className={toolInputClass}
                inputMode="decimal"
                value={largest}
                onChange={(e) => setLargest(e.target.value)}
              />
            </>
          ) : null}
        </>
      }
      result={
        <>
          <p className="font-sans text-[13px] text-text-dim mb-4 uppercase tracking-[0.12em] font-bold">
            Result
          </p>
          <ResultLine
            label="Equal weight per name"
            value={
              result.equalWeightPct == null
                ? "—"
                : formatPercentTyped(result.equalWeightPct, 2)
            }
          />
          <ResultLine
            label="Portfolio impact (equal weight)"
            value={
              result.equalImpactPts == null
                ? "—"
                : `${formatNumber(result.equalImpactPts, 2)} pts`
            }
          />
          {topHeavy ? (
            <>
              <ResultLine
                label="Each other name (even split)"
                value={
                  result.otherWeightPct == null
                    ? "—"
                    : formatPercentTyped(result.otherWeightPct, 2)
                }
              />
              <ResultLine
                label="Portfolio impact (largest name)"
                value={
                  result.topHeavyImpactPts == null
                    ? "—"
                    : `${formatNumber(result.topHeavyImpactPts, 2)} pts`
                }
              />
            </>
          ) : null}
          <p className="font-sans text-[12px] text-text-dim mt-6 leading-relaxed">
            UI illustration: N = 10 at 10% each with a −50% move shows −5.0
            points. At 25% largest weight the same move shows −12.5 points. Sample
            keystrokes, not a portfolio recommendation.
          </p>
        </>
      }
    />
  );
}
