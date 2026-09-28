"use client";

import { useMemo, useState } from "react";
import {
  formatPercentFromRatio,
  ratioToMarginPercent,
} from "@/lib/tools/format";
import { TOOL_RATIO_LABELS } from "@/lib/tools/whitelist";
import { useSnapshotFields } from "@/components/tools/ticker-lookup";
import {
  ResultLine,
  ToolGrid,
  toolInputClass,
  ToolFieldLabel,
} from "@/components/tools/tool-shell";

const MOAT_OPTIONS = [
  { id: "cost", label: "Cost advantage" },
  { id: "switching", label: "Switching costs" },
  { id: "network", label: "Network effects" },
  { id: "intangible", label: "Intangible assets" },
  { id: "scale", label: "Efficient scale" },
] as const;

const FIGURE_KEYS = [
  "grossProfitMarginTTM",
  "operatingProfitMarginTTM",
  "netProfitMarginTTM",
  "returnOnEquityTTM",
  "returnOnAssetsTTM",
  "returnOnCapitalEmployedTTM",
  "revenueGrowthTTM",
] as const;

function formatFigure(key: string, value: number | string | null | undefined) {
  if (value == null) return "not in the snapshot";
  if (key === "growthBasisPeriod") return String(value);
  if (typeof value === "number") {
    if (
      key.includes("Margin") ||
      key.includes("Growth") ||
      key.startsWith("returnOn")
    ) {
      return formatPercentFromRatio(value);
    }
    return String(value);
  }
  return String(value);
}

export function CompetitiveAdvantageWorksheet() {
  const { fields, sector, Ticker } = useSnapshotFields(
    "competitive-advantage-worksheet",
  );
  const [checks, setChecks] = useState<Record<string, boolean>>({});

  const sentence = useMemo(() => {
    const marked = MOAT_OPTIONS.filter((o) => checks[o.id]).map((o) =>
      o.label.toLowerCase(),
    );
    if (marked.length === 0) return "No moat sources marked yet.";
    if (marked.length === 1) return `You marked ${marked[0]}.`;
    const last = marked.pop();
    return `You marked ${marked.join(", ")}, and ${last}.`;
  }, [checks]);

  const basis = fields.growthBasisPeriod;

  return (
    <ToolGrid
      inputs={
        <>
          <Ticker />
          <p className="font-sans text-[13px] font-bold uppercase tracking-[0.12em] text-text-dim mb-3">
            Moat checklist
          </p>
          <ul className="space-y-3 mb-2">
            {MOAT_OPTIONS.map((o) => (
              <li key={o.id}>
                <label className="flex items-start gap-3 font-sans text-[14px] text-text-muted cursor-pointer">
                  <input
                    type="checkbox"
                    checked={Boolean(checks[o.id])}
                    onChange={(e) =>
                      setChecks((prev) => ({ ...prev, [o.id]: e.target.checked }))
                    }
                    className="mt-1 h-4 w-4 rounded border-border-strong"
                  />
                  {o.label}
                </label>
              </li>
            ))}
          </ul>
        </>
      }
      result={
        <>
          <p className="font-sans text-[15px] text-text mb-6 leading-relaxed">
            {sentence}
          </p>
          {sector ? (
            <ResultLine label="Sector" value={sector} mono={false} />
          ) : null}
          {FIGURE_KEYS.map((key) => (
            <ResultLine
              key={key}
              label={TOOL_RATIO_LABELS[key] ?? key}
              value={formatFigure(key, fields[key])}
            />
          ))}
          {basis ? (
            <ResultLine
              label={TOOL_RATIO_LABELS.growthBasisPeriod}
              value={String(basis)}
            />
          ) : null}
        </>
      }
    />
  );
}
