"use client";

import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { useTheme } from "@/components/providers/theme-provider";
import { formatUsd } from "@/lib/portfolio";
import type { DcaPoint } from "@/lib/hooks/use-dca";

type ThemeName = "light" | "dark";

const COLORS: Record<
  ThemeName,
  { picks: string; voo: string; contributed: string }
> = {
  light: { picks: "#16A34A", voo: "#1F5A66", contributed: "#A3A3A3" },
  dark: { picks: "#22C55E", voo: "#6EACBA", contributed: "#737373" },
};

const CHROME: Record<ThemeName, { grid: string; tick: string; cursor: string }> = {
  light: { grid: "#E5E5E5", tick: "#737373", cursor: "#D4D4D4" },
  dark: { grid: "#262626", tick: "#737373", cursor: "#333333" },
};

function formatAxis(value: number): string {
  if (Math.abs(value) >= 1000) return `$${Math.round(value / 1000)}k`;
  return `$${Math.round(value)}`;
}

function formatShortDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

export function DcaWealthChart({ series }: { series: DcaPoint[] }) {
  const theme = (useTheme().resolved ?? "dark") as ThemeName;
  const colors = COLORS[theme];
  const chrome = CHROME[theme];

  if (series.filter((p) => p.voo != null || p.picks != null).length < 2) {
    return (
      <div className="data-card h-80 flex flex-col items-center justify-center px-6 text-center">
        <p className="field-label">Building the sample</p>
        <p className="mt-2 max-w-sm font-sans text-[13px] text-text-muted">
          The comparison fills in after the first two Friday deposits have
          marks.
        </p>
      </div>
    );
  }

  return (
    <div className="data-card p-4 sm:p-5">
      <div className="mb-4 flex flex-wrap items-center gap-x-5 gap-y-2">
        <LegendSwatch color={colors.picks} label="BUY list" />
        <LegendSwatch color={colors.voo} dash="7 4" label="VOO" />
        <LegendSwatch color={colors.contributed} dash="2 4" label="Deposited" />
      </div>
      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={series} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid stroke={chrome.grid} vertical={false} />
            <XAxis
              dataKey="date"
              tickFormatter={formatShortDate}
              tick={{ fill: chrome.tick, fontSize: 11 }}
              axisLine={{ stroke: chrome.grid }}
              tickLine={false}
              minTickGap={28}
            />
            <YAxis
              tickFormatter={formatAxis}
              tick={{ fill: chrome.tick, fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              width={48}
            />
            <Tooltip
              cursor={{ stroke: chrome.cursor }}
              content={<DcaTooltip />}
            />
            <Line
              type="monotone"
              dataKey="picks"
              name="BUY list"
              stroke={colors.picks}
              strokeWidth={2.25}
              dot={false}
              connectNulls
            />
            <Line
              type="monotone"
              dataKey="voo"
              name="VOO"
              stroke={colors.voo}
              strokeWidth={1.75}
              strokeDasharray="7 4"
              dot={false}
              connectNulls
            />
            <Line
              type="monotone"
              dataKey="contributed"
              name="Deposited"
              stroke={colors.contributed}
              strokeWidth={1.25}
              strokeDasharray="2 4"
              dot={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function LegendSwatch({
  color,
  dash,
  label,
}: {
  color: string;
  dash?: string;
  label: string;
}) {
  return (
    <span className="inline-flex items-center gap-2 font-sans text-[12px] text-text-muted">
      <svg width="22" height="8" aria-hidden>
        <line
          x1="0"
          y1="4"
          x2="22"
          y2="4"
          stroke={color}
          strokeWidth="2"
          strokeDasharray={dash}
        />
      </svg>
      {label}
    </span>
  );
}

function DcaTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { name: string; value: number; color: string }[];
  label?: string;
}) {
  if (!active || !payload?.length || !label) return null;
  return (
    <div className="rounded-lg border border-border bg-bg px-3 py-2 shadow-sm">
      <p className="mb-1.5 font-sans text-[11px] text-text-muted">
        {formatShortDate(label)}
      </p>
      {payload.map((row) => (
        <p
          key={row.name}
          className="font-mono text-[12px] tabular-nums"
          style={{ color: row.color }}
        >
          {row.name} {formatUsd(row.value)}
        </p>
      ))}
    </div>
  );
}
