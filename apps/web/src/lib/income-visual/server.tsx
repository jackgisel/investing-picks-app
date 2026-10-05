import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import type { ReactElement } from "react";
import { OPS_API_BASE } from "@/lib/api-config";
import { CARD_SIZE, IncomeVisualCard, type CardFonts } from "./card";
import {
  MixCard,
  PickResultCard,
  PrintCard,
  QuarterStripCard,
  RankCard,
  SurpriseCard,
  WorkforceListCard,
} from "./share-cards";
import { money, signedPct, signedPp } from "./format";
import {
  incomeImagePlan,
  quarterStrip,
  segmentMix,
  type DailyGraphicKind,
  type IncomeImageKind,
  type MixRow,
  type QuarterPoint,
  type RankRow,
  type Surprise,
  type WeekRanks,
  type WorkforceRow,
  type WorkforceSelection,
} from "./graphics";
import { buildIncomeFlow, type PeriodType } from "./model";
import type { IncomePayload, IncomeVisual } from "./visual";

export {
  incomeVisualDedupeKey,
  incomeVisualFrom,
  incomeVisualKey,
  incomeVisualPostText,
  TICKER_PATTERN,
  type IncomePayload,
  type IncomeVisual,
} from "./visual";

/** Server half of the income visuals: read what the worker stored, and draw it. */

export type IncomeListItem = {
  ticker: string;
  name: string | null;
  sector: string | null;
  market_cap: number | null;
  period: string;
  fiscal_label: string;
  accepted_date: string | null;
  revenue: number | null;
  held: boolean;
};

export type IncomeList = {
  recent: IncomeListItem[];
  annual?: IncomeListItem[];
  held: IncomeListItem[];
  days: number;
};

export type WorkforcePayload = { rows: WorkforceRow[] };

function opsHeaders(): Record<string, string> | null {
  const key = process.env.OPS_API_KEY;
  return key ? { "X-Ops-Key": key } : null;
}

export async function fetchIncomePayload(
  ticker: string,
  periodType: PeriodType = "quarter",
): Promise<IncomePayload | null> {
  const headers = opsHeaders();
  if (!headers) return null;
  const res = await fetch(
    `${OPS_API_BASE}/income-statements/${encodeURIComponent(ticker)}?period_type=${periodType}`,
    { headers, cache: "no-store" },
  );
  if (!res.ok) return null;
  return (await res.json()) as IncomePayload;
}

export async function fetchIncomeList(days = 7): Promise<IncomeList | null> {
  const headers = opsHeaders();
  if (!headers) return null;
  const res = await fetch(`${OPS_API_BASE}/income-statements?days=${days}`, {
    headers,
    cache: "no-store",
  });
  if (!res.ok) return null;
  return (await res.json()) as IncomeList;
}

/** Pull one ticker from FMP through the API. Throws with the API's reason. */
export async function refreshIncomeStatement(ticker: string): Promise<void> {
  const headers = opsHeaders();
  if (!headers) throw new Error("OPS_API_KEY is not configured");
  const res = await fetch(
    `${OPS_API_BASE}/income-statements/${encodeURIComponent(ticker)}/refresh`,
    { method: "POST", headers, cache: "no-store" },
  );
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { detail?: string } | null;
    throw new Error(body?.detail ?? `Refresh failed (${res.status})`);
  }
}

let fontCache: Promise<Buffer[]> | null = null;

function fonts(): Promise<Buffer[]> {
  fontCache ??= Promise.all(
    [
      "fonts/outfit-500.ttf",
      "fonts/outfit-800.ttf",
      "fonts/ibm-plex-mono-500.ttf",
      "fonts/ibm-plex-mono-600.ttf",
    ].map((rel) => readFile(join(process.cwd(), "public", rel))),
  );
  return fontCache;
}

const CARD_FONTS: CardFonts = { sans: "Outfit", mono: "IBM Plex Mono" };

async function imageResponse(
  node: ReactElement,
  init: { headers?: Record<string, string> } = {},
): Promise<ImageResponse> {
  const [outfit500, outfit800, mono500, mono600] = await fonts();
  return new ImageResponse(node, {
    width: CARD_SIZE,
    height: CARD_SIZE,
    headers: init.headers,
    fonts: [
      { name: "Outfit", data: outfit500, style: "normal", weight: 500 },
      { name: "Outfit", data: outfit800, style: "normal", weight: 800 },
      { name: "IBM Plex Mono", data: mono500, style: "normal", weight: 500 },
      { name: "IBM Plex Mono", data: mono600, style: "normal", weight: 600 },
    ],
  });
}

export async function renderIncomeVisual(
  visual: IncomeVisual,
  init: { headers?: Record<string, string> } = {},
  eyebrow?: string | null,
): Promise<ImageResponse> {
  return imageResponse(
    <IncomeVisualCard
      ticker={visual.payload.ticker}
      name={visual.payload.name}
      statement={visual.statement}
      flow={visual.flow}
      fonts={CARD_FONTS}
      eyebrow={eyebrow}
    />,
    init,
  );
}

export async function renderIncomeVisualPng(
  visual: IncomeVisual,
  eyebrow?: string | null,
): Promise<Buffer> {
  const res = await renderIncomeVisual(visual, {}, eyebrow);
  return Buffer.from(await res.arrayBuffer());
}

export async function renderSharePng(node: ReactElement): Promise<Buffer> {
  const res = await imageResponse(node);
  return Buffer.from(await res.arrayBuffer());
}

export function incomePostNodes(
  visual: IncomeVisual,
  extras: { eyebrow: string; surprise: Surprise | null; mix: MixRow[] | null },
): ReactElement[] {
  const strip = quarterStrip(visual.payload.statements);
  const plan = incomeImagePlan({
    periodType: visual.statement.period_type,
    strip: strip.length >= 2,
    mix: Boolean(extras.mix && extras.mix.length >= 2),
    surprise: Boolean(extras.surprise && (extras.surprise.eps !== null || extras.surprise.revenue !== null)),
  });
  const nodes: ReactElement[] = [];
  for (const kind of plan) {
    const node = incomeNode(kind, visual, extras, strip);
    if (node) nodes.push(node);
  }
  return nodes;
}

function incomeNode(
  kind: IncomeImageKind,
  visual: IncomeVisual,
  extras: { eyebrow: string; surprise: Surprise | null; mix: MixRow[] | null },
  strip: QuarterPoint[],
): ReactElement | null {
  const { eyebrow, surprise, mix } = extras;
  const ticker = visual.payload.ticker;
  const label = visual.statement.fiscal_label;
  if (kind === "print") {
    return (
      <PrintCard eyebrow={eyebrow} ticker={ticker} fiscalLabel={label} flow={visual.flow} fonts={CARD_FONTS} />
    );
  }
  if (kind === "strip") {
    return <QuarterStripCard eyebrow={eyebrow} ticker={ticker} points={strip} fonts={CARD_FONTS} />;
  }
  if (kind === "mix" && mix) {
    return <MixCard eyebrow={eyebrow} ticker={ticker} fiscalLabel={label} rows={mix} fonts={CARD_FONTS} />;
  }
  if (kind === "surprise" && surprise) {
    return <SurpriseCard eyebrow={eyebrow} ticker={ticker} fiscalLabel={label} surprise={surprise} fonts={CARD_FONTS} />;
  }
  if (kind === "sankey") {
    return (
      <IncomeVisualCard
        ticker={ticker}
        name={visual.payload.name}
        statement={visual.statement}
        flow={visual.flow}
        fonts={CARD_FONTS}
        eyebrow={eyebrow}
      />
    );
  }
  return null;
}

export function mixFor(visual: IncomeVisual): MixRow[] | null {
  if (visual.statement.period_type !== "annual" || !visual.flow.hasSegments) return null;
  const prior = visual.prior ? buildIncomeFlow(visual.prior, null) : null;
  return segmentMix(visual.flow, prior);
}

export function weekNodes(ranks: WeekRanks): ReactElement[] {
  const nodes: ReactElement[] = [
    <RankCard
      key="revenue"
      eyebrow="This week"
      title="Revenue Y/Y"
      rows={ranks.revenue}
      format={(v) => signedPct(v)}
      note="Theme-list companies that reported. Not investment advice."
      fonts={CARD_FONTS}
    />,
  ];
  if (ranks.margin.length >= 2) {
    nodes.push(
      <RankCard
        key="margin"
        eyebrow="This week"
        title="Margin change"
        subtitle="Operating margin, points"
        rows={ranks.margin}
        format={(v) => signedPp(v)}
        note="Change versus the year-ago quarter."
        fonts={CARD_FONTS}
      />,
    );
  }
  const surpriseRows = [ranks.beat, ranks.miss].filter((r): r is RankRow => r !== null);
  if (surpriseRows.length) {
    nodes.push(
      <RankCard
        key="surprise"
        eyebrow="This week"
        title="EPS vs estimate"
        rows={surpriseRows}
        format={(v) => signedPct(v)}
        note="Largest beat and largest miss."
        fonts={CARD_FONTS}
      />,
    );
  }
  return nodes.slice(0, 4);
}

export function workforceNodes(selection: WorkforceSelection): ReactElement[] {
  const nodes: ReactElement[] = [
    <WorkforceListCard
      key="productivity"
      eyebrow="Workforce"
      title="Revenue / employee"
      rows={selection.productivity}
      line={(r) => ({ value: money(r.rev_per_employee ?? 0), color: "#FAFAFA" })}
      note="Theme list only. Annual filings. Not investment advice."
      fonts={CARD_FONTS}
    />,
  ];
  if (selection.leverage.length >= 2) {
    nodes.push(
      <WorkforceListCard
        key="leverage"
        eyebrow="Workforce"
        title="Revenue vs headcount"
        rows={selection.leverage}
        line={(r) => ({
          value: signedPp((r.leverage ?? 0) * 100),
          color: (r.leverage ?? 0) >= 0 ? "#A8D9A0" : "#F07167",
        })}
        note="Revenue growth minus headcount growth."
        fonts={CARD_FONTS}
      />,
    );
  }
  if (selection.hiring.length >= 2) {
    nodes.push(
      <WorkforceListCard
        key="hiring"
        eyebrow="Workforce"
        title="Open roles"
        rows={selection.hiring}
        line={(r) => ({
          value: signedPct(r.openings_change_90d ?? 0),
          color: (r.openings_change_90d ?? 0) >= 0 ? "#A8D9A0" : "#F07167",
        })}
        note="Verified boards. Change over about 90 days."
        fonts={CARD_FONTS}
      />,
    );
  }
  return nodes;
}

export function dailyNodes(kind: DailyGraphicKind, rows: WorkforceRow[]): ReactElement[] {
  const title = kind === "jobs" ? "Open roles" : kind === "headcount" ? "Headcount" : "Revenue";
  const note =
    kind === "jobs"
      ? "Change in open roles over about 90 days. Theme list. Not a holding."
      : kind === "headcount"
        ? "Headcount versus a year ago. Theme list. Not a holding."
        : "Revenue versus a year ago. Theme list. Not a holding.";
  return [
    <WorkforceListCard
      key={kind}
      eyebrow={title}
      title={title}
      rows={rows}
      line={(row) => {
        const value =
          kind === "jobs"
            ? row.openings_change_90d
            : kind === "headcount"
              ? (row.employees_yoy ?? null)
              : (row.revenue_yoy ?? null);
        return {
          value: signedPct(value ?? 0),
          color: (value ?? 0) >= 0 ? "#A8D9A0" : "#F07167",
        };
      }}
      note={note}
      fonts={CARD_FONTS}
    />,
  ];
}

export function pickResultNode(args: {
  ticker: string;
  returnLabel: string;
  revenueLabel: string;
}): ReactElement {
  return (
    <PickResultCard
      ticker={args.ticker}
      returnLabel={args.returnLabel}
      revenueLabel={args.revenueLabel}
      fonts={CARD_FONTS}
    />
  );
}

export async function fetchThemeWorkforce(tickers: string[]): Promise<WorkforceRow[] | null> {
  const headers = opsHeaders();
  if (!headers || tickers.length === 0) return null;
  const res = await fetch(
    `${OPS_API_BASE}/income-statements/x-workforce?tickers=${encodeURIComponent(tickers.join(","))}`,
    { headers, cache: "no-store" },
  );
  if (!res.ok) return null;
  const body = (await res.json()) as WorkforcePayload;
  return Array.isArray(body.rows) ? body.rows : null;
}
