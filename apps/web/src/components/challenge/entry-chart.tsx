"use client";

import { useState } from "react";
import type { SeriesPoint } from "@/lib/challenge/db";

const W = 720;
const H = 260;
const PAD = { top: 16, right: 16, bottom: 28, left: 64 };
const START = 10_000;

function money(v: number): string {
  return `$${Math.round(v).toLocaleString("en-US")}`;
}

function label(iso: string): string {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "2-digit",
    timeZone: "UTC",
  });
}

/** At most ~260 points, keeping the first and last day exactly. */
function thin(points: SeriesPoint[]): SeriesPoint[] {
  if (points.length <= 260) return points;
  const step = Math.ceil(points.length / 260);
  const out = points.filter((_, i) => i % step === 0);
  if (out[out.length - 1] !== points[points.length - 1]) out.push(points[points.length - 1]);
  return out;
}

/** $10,000 in the entry against $10,000 in SPY, from the same first close. */
export function EntryChart({ points: raw }: { points: SeriesPoint[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const points = thin(raw);
  if (points.length < 2) {
    return (
      <p className="font-sans text-[14px] text-text-muted">
        The chart starts after the second close. Check back tomorrow evening.
      </p>
    );
  }

  const vals = points.flatMap((p) => [p.growth * START, p.spy * START]);
  const lo = Math.min(...vals, START);
  const hi = Math.max(...vals, START);
  const pad = (hi - lo) * 0.08 || START * 0.02;
  const yMin = lo - pad;
  const yMax = hi + pad;
  const last = points.length - 1;
  const x = (i: number) => PAD.left + (i / last) * (W - PAD.left - PAD.right);
  const y = (v: number) => PAD.top + (1 - (v - yMin) / (yMax - yMin)) * (H - PAD.top - PAD.bottom);
  const path = (key: "growth" | "spy") =>
    points.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p[key] * START).toFixed(1)}`).join(" ");
  const ticks = [yMin + pad, (yMin + yMax) / 2, yMax - pad];

  const at = hover ?? last;
  const cur = points[at];

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-baseline gap-x-6 gap-y-1 font-sans text-[13px]">
        <span className="text-text-dim">{label(cur.date)}</span>
        <span className="inline-flex items-center gap-2 text-text">
          <span className="h-0.5 w-4 rounded-full bg-accent-mint" aria-hidden />
          Portfolio <span className="font-mono font-semibold">{money(cur.growth * START)}</span>
        </span>
        <span className="inline-flex items-center gap-2 text-text-muted">
          <span className="h-0.5 w-4 rounded-full bg-text-dim" aria-hidden />
          S&amp;P 500 <span className="font-mono">{money(cur.spy * START)}</span>
        </span>
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-auto w-full touch-none select-none"
        role="img"
        aria-label={`$10,000 in the portfolio is now ${money(points[last].growth * START)}, against ${money(points[last].spy * START)} in the S&P 500.`}
        onPointerMove={(e) => {
          const box = e.currentTarget.getBoundingClientRect();
          const px = ((e.clientX - box.left) / box.width) * W;
          const i = Math.round(((px - PAD.left) / (W - PAD.left - PAD.right)) * last);
          setHover(Math.max(0, Math.min(last, i)));
        }}
        onPointerLeave={() => setHover(null)}
      >
        {ticks.map((t) => (
          <g key={t}>
            <line x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} className="stroke-border" strokeDasharray="3 4" />
            <text x={PAD.left - 8} y={y(t) + 4} textAnchor="end" fontSize={11} className="fill-text-dim font-mono">
              {money(t)}
            </text>
          </g>
        ))}
        <path d={path("spy")} fill="none" className="stroke-text-dim" strokeWidth={1.5} />
        <path d={path("growth")} fill="none" className="stroke-accent-mint" strokeWidth={2.5} strokeLinejoin="round" />
        {hover !== null && (
          <line x1={x(at)} x2={x(at)} y1={PAD.top} y2={H - PAD.bottom} className="stroke-border-light" />
        )}
        <circle cx={x(at)} cy={y(cur.growth * START)} r={4} className="fill-accent-mint" />
        <text x={PAD.left} y={H - 8} fontSize={11} className="fill-text-dim font-mono">
          {label(points[0].date)}
        </text>
        <text x={W - PAD.right} y={H - 8} fontSize={11} textAnchor="end" className="fill-text-dim font-mono">
          {label(points[last].date)}
        </text>
      </svg>
    </div>
  );
}
