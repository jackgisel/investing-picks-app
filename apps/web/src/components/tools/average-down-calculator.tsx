"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  AVERAGE_DOWN_DEFAULTS,
  REVERSE_MESSAGES,
  averageDown,
  combineLots,
  parseAverageDownQuery,
  plannedAddShares,
  serializeAverageDownQuery,
  sharesToHitAverage,
  type AverageDownQuery,
  type ToolSearchParams,
} from "@/lib/tools/average-down";
import { formatNumber, formatPercentTyped, parseOptionalNumber } from "@/lib/tools/format";
import {
  ResultLine,
  ToolFieldLabel,
  ToolGrid,
  toolInputClass,
} from "@/components/tools/tool-shell";

const PATH = "/tools/average-down-calculator";

function formatUsd(value: number | null | undefined, digits = 2): string {
  if (value == null || !Number.isFinite(value)) return "—";
  const body = formatNumber(Math.abs(value), digits);
  return value < 0 ? `-$${body}` : `$${body}`;
}

function formatBreakeven(pct: number | null): string {
  if (pct == null || !Number.isFinite(pct)) return "—";
  if (pct === 0) return "0% (already at cost)";
  const abs = formatPercentTyped(Math.abs(pct), 2);
  return pct > 0 ? `+${abs} rise` : `-${abs} fall`;
}

function Segmented<T extends string>({
  legend,
  value,
  onChange,
  options,
}: {
  legend: string;
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: string }[];
}) {
  const name = legend.replace(/\s+/g, "-").toLowerCase();
  return (
    <fieldset className="mb-6">
      <legend className="block font-sans text-[13px] font-bold uppercase tracking-[0.1em] text-text-dim mb-2">
        {legend}
      </legend>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => {
          const id = `${name}-${option.value}`;
          const active = value === option.value;
          return (
            <label
              key={option.value}
              htmlFor={id}
              className={`cursor-pointer rounded-pill border px-4 py-2 font-sans text-[13px] font-semibold ${
                active
                  ? "border-text bg-bg-secondary text-text"
                  : "border-border-strong text-text-muted"
              }`}
            >
              <input
                id={id}
                className="sr-only"
                type="radio"
                name={name}
                checked={active}
                onChange={() => onChange(option.value)}
              />
              {option.label}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

export function AverageDownCalculator({
  initialQuery,
}: {
  initialQuery?: ToolSearchParams;
}) {
  const dirty = useRef(false);
  const [state, setState] = useState<AverageDownQuery>(() =>
    parseAverageDownQuery(initialQuery),
  );

  function update(
    patch:
      | Partial<AverageDownQuery>
      | ((current: AverageDownQuery) => AverageDownQuery),
  ) {
    dirty.current = true;
    setState((current) =>
      typeof patch === "function" ? patch(current) : { ...current, ...patch },
    );
  }

  useEffect(() => {
    if (!dirty.current) return;
    const qs = serializeAverageDownQuery(state);
    const next = qs ? `${PATH}?${qs}` : PATH;
    const here = `${window.location.pathname}${window.location.search}`;
    if (here !== next) window.history.replaceState(null, "", next);
  }, [state]);

  const position = useMemo(() => {
    if (state.positionMode === "lots") {
      return combineLots(
        state.lots.map((lot) => ({
          shares: parseOptionalNumber(lot.shares) ?? Number.NaN,
          price: parseOptionalNumber(lot.price) ?? Number.NaN,
        })),
      );
    }
    const shares = parseOptionalNumber(state.shares);
    const avgCost = parseOptionalNumber(state.avgCost);
    if (shares == null || shares < 0) return null;
    if (shares === 0) return { shares: 0, avgCost: 0, invested: 0 };
    if (avgCost == null || avgCost < 0) return null;
    return { shares, avgCost, invested: shares * avgCost };
  }, [state.positionMode, state.lots, state.shares, state.avgCost]);

  const price = parseOptionalNumber(state.price);
  const add = parseOptionalNumber(state.add);
  const addShares =
    price != null && add != null
      ? plannedAddShares(add, state.addMode, price)
      : null;
  const portfolio = parseOptionalNumber(state.portfolio);
  const targetAvg = parseOptionalNumber(state.targetAvg);

  const result = useMemo(() => {
    if (!position || addShares == null || price == null) return null;
    return averageDown({
      shares: position.shares,
      avgCost: position.avgCost,
      price,
      addShares,
      portfolioValue: portfolio,
    });
  }, [position, addShares, price, portfolio]);

  const reverse = useMemo(() => {
    if (targetAvg == null || !position || price == null) return null;
    return sharesToHitAverage({
      shares: position.shares,
      avgCost: position.avgCost,
      price,
      targetAvg,
    });
  }, [position, price, targetAvg]);

  const weightWarning =
    result &&
    portfolio != null &&
    portfolio > 0 &&
    result.shares * result.price > portfolio
      ? "Portfolio value is smaller than this position at the current price, so weight exceeds 100%."
      : null;

  function setPositionMode(positionMode: "simple" | "lots") {
    update((current) => {
      if (positionMode === "lots") {
        const lots =
          current.lots.length > 0
            ? current.lots
            : [{ shares: current.shares, price: current.avgCost }];
        const seed =
          lots.length === 1 && !lots[0].shares && !lots[0].price
            ? [{ shares: current.shares, price: current.avgCost }]
            : lots;
        return { ...current, positionMode, lots: seed };
      }
      const combined = combineLots(
        current.lots.map((lot) => ({
          shares: parseOptionalNumber(lot.shares) ?? Number.NaN,
          price: parseOptionalNumber(lot.price) ?? Number.NaN,
        })),
      );
      return {
        ...current,
        positionMode,
        shares: combined ? String(combined.shares) : current.shares,
        avgCost: combined ? String(combined.avgCost) : current.avgCost,
      };
    });
  }

  return (
    <ToolGrid
      inputs={
        <>
          <Segmented
            legend="Existing position"
            value={state.positionMode}
            onChange={setPositionMode}
            options={[
              { value: "simple", label: "Shares and average" },
              { value: "lots", label: "List of buys" },
            ]}
          />

          {state.positionMode === "simple" ? (
            <>
              <ToolFieldLabel htmlFor="ad-shares" hint="Can be a fraction.">
                Current shares
              </ToolFieldLabel>
              <input
                id="ad-shares"
                className={`${toolInputClass} mb-6`}
                inputMode="decimal"
                autoComplete="off"
                value={state.shares}
                onChange={(e) => update({ shares: e.target.value })}
              />
              <ToolFieldLabel htmlFor="ad-avg">Average cost ($)</ToolFieldLabel>
              <input
                id="ad-avg"
                className={`${toolInputClass} mb-6`}
                inputMode="decimal"
                autoComplete="off"
                value={state.avgCost}
                onChange={(e) => update({ avgCost: e.target.value })}
              />
            </>
          ) : (
            <div className="mb-6 space-y-4">
              {state.lots.map((lot, index) => (
                <div
                  key={index}
                  className="grid grid-cols-[1fr_1fr_auto] gap-2 items-end"
                >
                  <div className="min-w-0">
                    <ToolFieldLabel htmlFor={`ad-lot-shares-${index}`}>
                      Buy {index + 1} shares
                    </ToolFieldLabel>
                    <input
                      id={`ad-lot-shares-${index}`}
                      className={toolInputClass}
                      inputMode="decimal"
                      autoComplete="off"
                      value={lot.shares}
                      onChange={(e) =>
                        update((current) => {
                          const lots = current.lots.map((row, i) =>
                            i === index ? { ...row, shares: e.target.value } : row,
                          );
                          return { ...current, lots };
                        })
                      }
                    />
                  </div>
                  <div className="min-w-0">
                    <ToolFieldLabel htmlFor={`ad-lot-price-${index}`}>
                      Price ($)
                    </ToolFieldLabel>
                    <input
                      id={`ad-lot-price-${index}`}
                      className={toolInputClass}
                      inputMode="decimal"
                      autoComplete="off"
                      value={lot.price}
                      onChange={(e) =>
                        update((current) => {
                          const lots = current.lots.map((row, i) =>
                            i === index ? { ...row, price: e.target.value } : row,
                          );
                          return { ...current, lots };
                        })
                      }
                    />
                  </div>
                  <button
                    type="button"
                    className="mb-0 min-h-[44px] min-w-[44px] rounded-soft border border-border-strong px-2 font-sans text-[12px] font-semibold text-text-muted hover:text-text"
                    aria-label={`Remove buy ${index + 1}`}
                    disabled={state.lots.length === 1}
                    onClick={() =>
                      update((current) => ({
                        ...current,
                        lots: current.lots.filter((_, i) => i !== index),
                      }))
                    }
                  >
                    Remove
                  </button>
                </div>
              ))}
              <button
                type="button"
                className="font-sans text-[13px] font-semibold text-text underline underline-offset-2 hover:opacity-80"
                onClick={() =>
                  update((current) => ({
                    ...current,
                    lots: [...current.lots, { shares: "", price: "" }],
                  }))
                }
              >
                Add a buy
              </button>
            </div>
          )}

          <ToolFieldLabel htmlFor="ad-price">Current price ($)</ToolFieldLabel>
          <input
            id="ad-price"
            className={`${toolInputClass} mb-6`}
            inputMode="decimal"
            autoComplete="off"
            value={state.price}
            onChange={(e) => update({ price: e.target.value })}
          />

          <Segmented
            legend="Planned add"
            value={state.addMode}
            onChange={(addMode) => update({ addMode })}
            options={[
              { value: "dollars", label: "Dollars" },
              { value: "shares", label: "Shares" },
            ]}
          />
          <ToolFieldLabel
            htmlFor="ad-add"
            hint={
              state.addMode === "dollars"
                ? "Cash you plan to add at the current price."
                : "Shares you plan to buy at the current price."
            }
          >
            {state.addMode === "dollars" ? "Add amount ($)" : "Add shares"}
          </ToolFieldLabel>
          <input
            id="ad-add"
            className={`${toolInputClass} mb-6`}
            inputMode="decimal"
            autoComplete="off"
            value={state.add}
            onChange={(e) => update({ add: e.target.value })}
          />

          <ToolFieldLabel
            htmlFor="ad-portfolio"
            hint="Optional. Turns on the position-weight panel. Treated as today's total, with the add as new cash."
          >
            Total portfolio value ($)
          </ToolFieldLabel>
          <input
            id="ad-portfolio"
            className={`${toolInputClass} mb-6`}
            inputMode="decimal"
            autoComplete="off"
            value={state.portfolio}
            onChange={(e) => update({ portfolio: e.target.value })}
          />

          <ToolFieldLabel
            htmlFor="ad-target"
            hint="Optional reverse mode: how many shares to buy at the current price to reach this average."
          >
            Target average cost ($)
          </ToolFieldLabel>
          <input
            id="ad-target"
            className={toolInputClass}
            inputMode="decimal"
            autoComplete="off"
            value={state.targetAvg}
            onChange={(e) => update({ targetAvg: e.target.value })}
          />
        </>
      }
      result={
        <div aria-live="polite">
          <p className="font-sans text-[13px] text-text-dim mb-4 uppercase tracking-[0.12em] font-bold">
            After the add
          </p>
          {result ? (
            <>
              <ResultLine
                label="New total shares"
                value={formatNumber(result.newShares, 4)}
              />
              <ResultLine
                label="New average cost"
                value={formatUsd(result.newAvgCost, 4)}
              />
              <ResultLine
                label="Total invested"
                value={formatUsd(result.newInvested, 2)}
              />
              <ResultLine
                label="Breakeven move before add"
                value={formatBreakeven(result.breakevenBeforePct)}
              />
              <ResultLine
                label="Breakeven move after add"
                value={formatBreakeven(result.breakevenAfterPct)}
              />
              <ResultLine
                label="Unrealized P/L now"
                value={formatUsd(result.unrealizedPl, 2)}
              />
              {result.addShares > 0 ? (
                <p className="font-sans text-[12px] text-text-dim mt-3 leading-relaxed">
                  The add itself is at today&apos;s price, so dollar P/L on the
                  old shares does not change at the moment you buy.
                </p>
              ) : null}
            </>
          ) : (
            <p className="font-sans text-[14px] text-text-muted leading-relaxed mb-4">
              Enter a current price above 0, a position (or a planned add), and
              a non-negative add to see the new average.
            </p>
          )}

          {reverse ? (
            <div className="mt-8 pt-6 border-t border-border">
              <p className="font-sans text-[13px] text-text-dim mb-4 uppercase tracking-[0.12em] font-bold">
                Shares to hit the target
              </p>
              {reverse.ok ? (
                <>
                  <ResultLine
                    label="Shares to buy"
                    value={formatNumber(reverse.shares, 4)}
                  />
                  <ResultLine
                    label="Cash to spend"
                    value={formatUsd(reverse.dollars, 2)}
                  />
                  <button
                    type="button"
                    className="mt-4 font-sans text-[13px] font-semibold text-text underline underline-offset-2 hover:opacity-80"
                    onClick={() =>
                      update({
                        addMode: "shares",
                        add: String(Number(reverse.shares.toFixed(4))),
                      })
                    }
                  >
                    Use this as the planned add
                  </button>
                </>
              ) : (
                <p className="font-sans text-[14px] text-text-muted leading-relaxed">
                  {REVERSE_MESSAGES[reverse.reason]}
                </p>
              )}
            </div>
          ) : null}

          {result?.weightBeforePct != null && result.weightAfterPct != null ? (
            <div className="mt-8 pt-6 border-t border-border">
              <p className="font-sans text-[13px] text-text-dim mb-4 uppercase tracking-[0.12em] font-bold">
                Position weight
              </p>
              {weightWarning ? (
                <p className="font-sans text-[13px] text-text-muted leading-relaxed mb-3">
                  {weightWarning}
                </p>
              ) : null}
              <ResultLine
                label="Weight before add"
                value={formatPercentTyped(result.weightBeforePct, 2)}
              />
              <ResultLine
                label="Weight after add"
                value={formatPercentTyped(result.weightAfterPct, 2)}
              />
              <ResultLine
                label="Portfolio hit, another 30% drop, before"
                value={`${formatNumber(result.hit30BeforePts, 2)} pts`}
              />
              <ResultLine
                label="Portfolio hit, another 30% drop, after"
                value={`${formatNumber(result.hit30AfterPts, 2)} pts`}
              />
              <ResultLine
                label="Portfolio hit, another 50% drop, before"
                value={`${formatNumber(result.hit50BeforePts, 2)} pts`}
              />
              <ResultLine
                label="Portfolio hit, another 50% drop, after"
                value={`${formatNumber(result.hit50AfterPts, 2)} pts`}
              />
              <p className="font-sans text-[12px] text-text-dim mt-4 leading-relaxed">
                The add is treated as new cash, so the portfolio total after the
                add is the value you typed plus the dollars you add. Hits are
                weight times the drop, in percentage points of the whole
                portfolio.
              </p>
            </div>
          ) : null}

          <p className="font-sans text-[12px] text-text-dim mt-6 leading-relaxed">
            Hypothetical starting figures: 100 shares at $60, now $36, add
            $3,000. Sample keystrokes, not a recommendation.
          </p>
          <button
            type="button"
            className="mt-3 font-sans text-[12px] font-semibold text-text-muted underline underline-offset-2 hover:text-text"
            onClick={() => {
              dirty.current = true;
              setState({
                ...AVERAGE_DOWN_DEFAULTS,
                lots: [...AVERAGE_DOWN_DEFAULTS.lots],
              });
            }}
          >
            Reset to the example
          </button>
        </div>
      }
    />
  );
}
