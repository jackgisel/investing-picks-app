"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  formatGrowth,
  formatPerEmployee,
  growthDomain,
  shapeLabel,
  type GrowthPayload,
  type GrowthPoint,
  type WorkforceShape,
} from "@/lib/workforce";

const W = 640;
const H = 380;
const PAD = { top: 18, right: 18, bottom: 40, left: 52 };

type State =
  | { state: "loading" }
  | { state: "error" }
  | { state: "ready"; data: GrowthPayload };

/**
 * Every screened company as one dot: headcount growth across, revenue growth
 * up. Above the dashed diagonal, revenue grew faster than headcount. One
 * series, so one color; the selected shape is picked out by dimming the rest,
 * never by repainting dots.
 */
const NO_POINTS: GrowthPoint[] = [];

export function GrowthScatter({
  shape,
  sector,
}: {
  shape: WorkforceShape | null;
  sector: string | null;
}) {
  const [load, setLoad] = useState<State>({ state: "loading" });
  const [hover, setHover] = useState<GrowthPoint | null>(null);
  const [attempt, setAttempt] = useState(0);

  const retry = useCallback(() => {
    setLoad({ state: "loading" });
    setAttempt((n) => n + 1);
  }, []);

  useEffect(() => {
    const ctl = new AbortController();
    fetch("/api/data/workforce-growth", { signal: ctl.signal })
      .then((r) => {
        if (!r.ok) throw new Error(String(r.status));
        return r.json() as Promise<GrowthPayload>;
      })
      .then((data) => setLoad({ state: "ready", data }))
      .catch((e) => {
        if (e?.name !== "AbortError") setLoad({ state: "error" });
      });
    return () => ctl.abort();
  }, [attempt]);

  // A stable reference while loading, so the memos below do not recompute.
  const points = load.state === "ready" ? load.data.points : NO_POINTS;
  const [xLo, xHi] = useMemo(() => growthDomain(points.map((p) => p.employees_yoy)), [points]);
  const [yLo, yHi] = useMemo(() => growthDomain(points.map((p) => p.revenue_yoy)), [points]);

  if (load.state === "loading") {
    return <p className="font-sans text-[13px] text-text-muted">Loading the chart</p>;
  }
  if (load.state === "error" || points.length === 0) {
    return (
      <p className="font-sans text-[13px] text-text-muted">
        The growth chart is not available right now.{" "}
        <button type="button" onClick={retry} className="underline underline-offset-2 hover:text-text">
          Try again
        </button>
      </p>
    );
  }

  const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
  const x = (v: number) =>
    PAD.left + ((clamp(v, xLo, xHi) - xLo) / (xHi - xLo)) * (W - PAD.left - PAD.right);
  const y = (v: number) =>
    PAD.top + (1 - (clamp(v, yLo, yHi) - yLo) / (yHi - yLo)) * (H - PAD.top - PAD.bottom);

  // The diagonal where revenue growth equals headcount growth, clipped to the box.
  const dLo = Math.max(xLo, yLo);
  const dHi = Math.min(xHi, yHi);

  const pct = (v: number) => `${Math.round(v * 100)}%`;
  // Label zero always; label an edge only if it is clear of zero's label.
  const xTicks = [xLo, 0, xHi].filter((v) => v === 0 || Math.abs(x(v) - x(0)) > 34);
  const yTicks = [yLo, 0, yHi].filter((v) => v === 0 || Math.abs(y(v) - y(0)) > 16);

  function onMove(e: React.PointerEvent<SVGSVGElement>) {
    const box = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - box.left) / box.width) * W;
    const py = ((e.clientY - box.top) / box.height) * H;
    let best: GrowthPoint | null = null;
    let bestD = 18 * 18;
    for (const p of points) {
      const d = (x(p.employees_yoy) - px) ** 2 + (y(p.revenue_yoy) - py) ** 2;
      if (d < bestD) {
        bestD = d;
        best = p;
      }
    }
    setHover(best);
  }

  const dim = (p: GrowthPoint) =>
    (shape !== null && p.shape !== shape) || (sector !== null && p.sector !== sector);

  return (
    <div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`Headcount growth against revenue growth for ${points.length} companies`}
        className="w-full touch-pan-y"
        onPointerMove={onMove}
        onPointerLeave={() => setHover(null)}
      >
        <line x1={x(0)} x2={x(0)} y1={PAD.top} y2={H - PAD.bottom} stroke="rgb(var(--color-border-strong))" strokeWidth={1} />
        <line x1={PAD.left} x2={W - PAD.right} y1={y(0)} y2={y(0)} stroke="rgb(var(--color-border-strong))" strokeWidth={1} />
        {dLo < dHi && (
          <line x1={x(dLo)} y1={y(dLo)} x2={x(dHi)} y2={y(dHi)} stroke="rgb(var(--color-text-dim))" strokeDasharray="4 4" strokeWidth={1} />
        )}

        {xTicks.map((t) => (
          <text key={`x${t}`} x={x(t)} y={H - PAD.bottom + 16} textAnchor="middle" className="fill-text-dim font-mono" fontSize={11}>
            {pct(t)}
          </text>
        ))}
        {yTicks.map((t) => (
          <text key={`y${t}`} x={PAD.left - 8} y={y(t) + 4} textAnchor="end" className="fill-text-dim font-mono" fontSize={11}>
            {pct(t)}
          </text>
        ))}
        <text x={(PAD.left + W - PAD.right) / 2} y={H - 6} textAnchor="middle" className="fill-text-muted font-sans" fontSize={12}>
          Headcount growth, last fiscal year
        </text>
        <text transform={`translate(14 ${(PAD.top + H - PAD.bottom) / 2}) rotate(-90)`} textAnchor="middle" className="fill-text-muted font-sans" fontSize={12}>
          Revenue growth
        </text>

        <text x={PAD.left + 8} y={PAD.top + 14} className="fill-text-muted font-sans" fontSize={11}>Leaner</text>
        <text x={W - PAD.right - 8} y={PAD.top + 14} textAnchor="end" className="fill-text-muted font-sans" fontSize={11}>Growing, hiring</text>
        <text x={PAD.left + 8} y={H - PAD.bottom - 8} className="fill-text-muted font-sans" fontSize={11}>Shrinking</text>
        <text x={W - PAD.right - 8} y={H - PAD.bottom - 8} textAnchor="end" className="fill-text-muted font-sans" fontSize={11}>Hiring into decline</text>

        {points.map((p) => (
          <circle
            key={p.ticker}
            cx={x(p.employees_yoy)}
            cy={y(p.revenue_yoy)}
            r={3.5}
            fill="var(--chart-headcount)"
            fillOpacity={dim(p) ? 0.12 : 0.65}
          />
        ))}
        {hover && (
          <circle
            cx={x(hover.employees_yoy)}
            cy={y(hover.revenue_yoy)}
            r={6}
            fill="var(--chart-headcount)"
            stroke="rgb(var(--color-bg))"
            strokeWidth={2}
          />
        )}
      </svg>
      <p className="mt-1 min-h-[20px] font-mono text-[12px] text-text-muted" aria-live="polite">
        {hover
          ? `${hover.ticker}${hover.name ? ` (${hover.name})` : ""}: headcount ${formatGrowth(hover.employees_yoy)}, revenue ${formatGrowth(hover.revenue_yoy)}, ${formatPerEmployee(hover.rev_per_employee)} per employee, ${shapeLabel(hover.shape).toLowerCase()}`
          : `${points.length} companies. Dashed line: revenue growing as fast as headcount. Extreme values sit on the edge.`}
      </p>
    </div>
  );
}
