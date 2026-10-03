"use client";

import { useState } from "react";
import {
  fiscalYearLabel,
  fiscalYearShort,
  formatEmployees,
  formatGrowth,
  formatOpenings,
  formatOpeningsRate,
  formatPerEmployee,
  indexTo100,
  type WorkforceHistory,
} from "@/lib/workforce";
import { formatCompactUsd } from "@/lib/market-cap";

const W = 640;
const H = 220;
const PAD = { top: 16, right: 92, bottom: 28, left: 40 };

/**
 * Headcount and revenue on one axis, both indexed to 100 at the first fiscal
 * year we hold. They are different units, so a shared raw axis would flatten
 * one of them; indexing keeps a single y scale and answers the actual
 * question: which one grew faster.
 */
export function HistoryChart({ history }: { history: WorkforceHistory }) {
  const [hover, setHover] = useState<number | null>(null);
  // A point needs a positive headcount and revenue to be indexed at all.
  const pts = history.series.filter((p) => p.employees > 0 && p.revenue > 0);

  if (pts.length < 2) {
    return (
      <p className="font-sans text-[13px] text-text-muted">
        Only one fiscal year on file so far, so there is no trend to draw yet.
      </p>
    );
  }

  const hc = indexTo100(pts.map((p) => p.employees));
  const rev = indexTo100(pts.map((p) => p.revenue));
  const all = [...hc, ...rev].filter(Number.isFinite);
  const lo = Math.min(...all, 100);
  const hi = Math.max(...all, 100);
  const span = hi - lo || 1;
  // An index of two positive series cannot go below zero, so neither can the axis.
  const yMin = Math.max(0, lo - span * 0.08);
  const yMax = hi + span * 0.08;

  const x = (i: number) =>
    PAD.left + (i / (pts.length - 1)) * (W - PAD.left - PAD.right);
  const y = (v: number) =>
    PAD.top + (1 - (v - yMin) / (yMax - yMin)) * (H - PAD.top - PAD.bottom);
  const line = (vs: number[]) =>
    vs.map((v, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");

  // Gridlines sit at the real tick values; the labels are rounded for display.
  const ticks = [yMin, (yMin + yMax) / 2, yMax];
  const last = pts.length - 1;
  // Labels at the line ends; nudge apart if the two finish close together.
  const labelY = (v: number, other: number) => {
    const raw = y(v);
    return Math.abs(y(v) - y(other)) < 14 ? raw + (v >= other ? -8 : 8) : raw;
  };

  function onMove(e: React.PointerEvent<SVGSVGElement>) {
    const box = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - box.left) / box.width) * W;
    const i = Math.round(((px - PAD.left) / (W - PAD.left - PAD.right)) * last);
    setHover(Math.max(0, Math.min(last, i)));
  }

  const active = hover !== null ? pts[hover] : null;

  return (
    <div className="max-w-[760px]">
      <div className="mb-2 flex flex-wrap items-center gap-x-5 gap-y-1 font-sans text-[12px] text-text-muted">
        <span className="inline-flex items-center gap-2">
          <span className="h-0.5 w-4 rounded-full" style={{ background: "var(--chart-headcount)" }} />
          Employees
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="h-0.5 w-4 rounded-full" style={{ background: "var(--chart-revenue)" }} />
          Revenue
        </span>
        <span>Indexed to 100 in {fiscalYearLabel(pts[0].period)}</span>
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`${history.ticker} employees and revenue, indexed to 100 in ${fiscalYearLabel(pts[0].period)}`}
        className="w-full touch-pan-y"
        onPointerMove={onMove}
        onPointerLeave={() => setHover(null)}
      >
        {ticks.map((t, i) => (
          <g key={i}>
            <line x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} stroke="rgb(var(--color-border))" strokeWidth={1} />
            <text x={PAD.left - 8} y={y(t) + 4} textAnchor="end" className="fill-text-dim font-mono" fontSize={11}>
              {Math.round(t)}
            </text>
          </g>
        ))}
        <line x1={PAD.left} x2={W - PAD.right} y1={y(100)} y2={y(100)} stroke="rgb(var(--color-border-light))" strokeDasharray="3 3" strokeWidth={1} />
        {pts.map((p, i) => (
          <text key={p.period} x={x(i)} y={H - 8} textAnchor="middle" className="fill-text-dim font-mono" fontSize={11}>
            {fiscalYearShort(p.period)}
          </text>
        ))}

        <path d={line(rev)} fill="none" stroke="var(--chart-revenue)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        <path d={line(hc)} fill="none" stroke="var(--chart-headcount)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />

        {hover !== null && (
          <line x1={x(hover)} x2={x(hover)} y1={PAD.top} y2={H - PAD.bottom} stroke="rgb(var(--color-border-strong))" strokeWidth={1} />
        )}
        {[{ vs: rev, c: "var(--chart-revenue)" }, { vs: hc, c: "var(--chart-headcount)" }].map(({ vs, c }) => {
          const i = hover ?? last;
          return (
            <circle key={c} cx={x(i)} cy={y(vs[i])} r={4} fill={c} stroke="rgb(var(--color-bg))" strokeWidth={2} />
          );
        })}

        <text x={x(last) + 10} y={labelY(rev[last], hc[last]) + 4} className="fill-text font-mono" fontSize={11}>
          Revenue {Math.round(rev[last])}
        </text>
        <text x={x(last) + 10} y={labelY(hc[last], rev[last]) + 4} className="fill-text font-mono" fontSize={11}>
          Staff {Math.round(hc[last])}
        </text>
      </svg>

      <p className="mt-1 min-h-[20px] font-mono text-[12px] text-text-muted" aria-live="polite">
        {active
          ? `${fiscalYearLabel(active.period)}: ${formatEmployees(active.employees)} employees, ${formatCompactUsd(active.revenue)} revenue, ${formatPerEmployee(active.rev_per_employee)} per employee`
          : "Hover a year for the numbers."}
      </p>

      <table className="mt-3 w-full font-mono text-[12px]">
        <caption className="sr-only">
          {history.ticker} employees and revenue by fiscal year
        </caption>
        <thead>
          <tr className="border-b border-border text-left font-sans text-[11px] uppercase tracking-[0.1em] text-text-dim">
            <th className="py-1.5 pr-3 font-semibold">Year ending</th>
            <th className="py-1.5 pr-3 text-right font-semibold">Employees</th>
            <th className="py-1.5 pr-3 text-right font-semibold">Revenue</th>
            <th className="py-1.5 pr-3 text-right font-semibold">Per employee</th>
            <th className="py-1.5 pr-3 text-right font-semibold">Staff YoY</th>
            <th className="py-1.5 text-right font-semibold">Revenue YoY</th>
          </tr>
        </thead>
        <tbody>
          {[...pts].reverse().map((p) => (
            <tr key={p.period} className="border-b border-border/60">
              <td className="py-1.5 pr-3">{fiscalYearLabel(p.period)}</td>
              <td className="py-1.5 pr-3 text-right">{formatEmployees(p.employees)}</td>
              <td className="py-1.5 pr-3 text-right">{formatCompactUsd(p.revenue)}</td>
              <td className="py-1.5 pr-3 text-right">{formatPerEmployee(p.rev_per_employee)}</td>
              <td className="py-1.5 pr-3 text-right">{formatGrowth(p.employees_yoy)}</td>
              <td className="py-1.5 text-right">{formatGrowth(p.revenue_yoy)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-4 border-t border-border pt-3 font-sans text-[13px] text-text-muted">
        {history.openings.length === 0 ? (
          <p>
            Open roles: we have not matched a verified job board for this company yet.
          </p>
        ) : (
          <>
            <p>
              Open roles on its job board:{" "}
              <span className="font-mono text-text">
                {formatOpenings(history.openings[history.openings.length - 1].open_count)}
              </span>{" "}
              ({formatOpeningsRate(history.openings_per_1000)}), as of{" "}
              {history.openings[history.openings.length - 1].as_of}.
              {history.openings_change_90d !== null
                ? ` ${formatGrowth(history.openings_change_90d)} over about 90 days.`
                : history.openings.length > 1
                  ? ` Tracking since ${history.openings[0].as_of}; the 90 day change appears once there are three months of history.`
                  : " Tracking started today, so there is no trend yet."}
            </p>
          </>
        )}
      </div>
    </div>
  );
}
