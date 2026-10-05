import type { ReactNode } from "react";
import type { IncomeFlow } from "./model";
import { CARD_SIZE, type CardFonts } from "./card";
import { money, pct, signedPct, signedPp } from "./format";
import type { MixRow, QuarterPoint, RankRow, Surprise, WorkforceRow } from "./graphics";

/**
 * The square cards that lead an X post. Same dialect as the Sankey card:
 * flex only, no SVG text. The Sankey stays the last image.
 */

const BG = "#0A0A0A";
const TEXT = "#FAFAFA";
const MUTED = "#A3A3A3";
const DIM = "#737373";
const MINT = "#A8D9A0";
const CORAL = "#F07167";

function tone(value: number | null): string {
  if (value === null || value === 0) return MUTED;
  return value > 0 ? MINT : CORAL;
}

export function ShareFrame({
  eyebrow,
  title,
  subtitle,
  note,
  fonts,
  children,
}: {
  eyebrow: string;
  title: string;
  subtitle?: string | null;
  note: string;
  fonts: CardFonts;
  children: ReactNode;
}) {
  return (
    <div
      style={{
        width: CARD_SIZE,
        height: CARD_SIZE,
        display: "flex",
        flexDirection: "column",
        background: BG,
        color: TEXT,
        padding: 56,
        fontFamily: fonts.sans,
      }}
    >
      <div style={{ display: "flex", fontFamily: fonts.mono, fontSize: 22, fontWeight: 600, color: MUTED }}>
        {eyebrow}
      </div>
      <div
        style={{
          display: "flex",
          marginTop: 18,
          fontSize: title.length > 18 ? 64 : 84,
          fontWeight: 800,
          letterSpacing: "-0.03em",
          lineHeight: 1,
        }}
      >
        {title}
      </div>
      {subtitle ? (
        <div style={{ display: "flex", marginTop: 12, fontFamily: fonts.mono, fontSize: 26, color: MUTED }}>
          {subtitle}
        </div>
      ) : null}
      <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>{children}</div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          fontFamily: fonts.mono,
          fontSize: 16,
          fontWeight: 500,
          color: DIM,
        }}
      >
        <div style={{ display: "flex" }}>{note}</div>
        <div style={{ display: "flex", color: MUTED }}>outpick.xyz</div>
      </div>
    </div>
  );
}

export function PrintCard({
  eyebrow,
  ticker,
  fiscalLabel,
  flow,
  fonts,
}: {
  eyebrow: string;
  ticker: string;
  fiscalLabel: string;
  flow: IncomeFlow;
  fonts: CardFonts;
}) {
  const m = flow.metrics;
  const stats: { label: string; value: string; detail: string | null; color: string }[] = [
    {
      label: "Revenue",
      value: money(flow.revenue, flow.currency),
      detail: m.revenueYoy === null ? null : `${signedPct(m.revenueYoy)} Y/Y`,
      color: tone(m.revenueYoy),
    },
    {
      label: "Operating margin",
      value: m.operatingMargin === null ? "-" : pct(m.operatingMargin),
      detail: m.operatingMarginPriorPp === null ? null : signedPp(m.operatingMarginPriorPp),
      color: tone(m.operatingMarginPriorPp),
    },
    {
      label: "Gross margin",
      value: m.grossMargin === null ? "-" : pct(m.grossMargin),
      detail: m.grossMarginPriorPp === null ? null : signedPp(m.grossMarginPriorPp),
      color: tone(m.grossMarginPriorPp),
    },
    {
      label: m.netIncome > 0 ? "Net income" : "Net loss",
      value: money(Math.abs(m.netIncome), flow.currency),
      detail: m.netIncomeYoy === null ? null : `${signedPct(m.netIncomeYoy)} Y/Y`,
      color: m.netIncome > 0 ? tone(m.netIncomeYoy) : CORAL,
    },
  ];
  return (
    <ShareFrame
      eyebrow={eyebrow}
      title={`$${ticker}`}
      subtitle={fiscalLabel}
      note="Company filings via FMP. Not investment advice."
      fonts={fonts}
    >
      <div style={{ display: "flex", flexWrap: "wrap", marginTop: 28 }}>
        {stats.map((s) => (
          <div
            key={s.label}
            style={{ display: "flex", flexDirection: "column", width: "50%", marginTop: 36 }}
          >
            <div style={{ display: "flex", fontFamily: fonts.mono, fontSize: 20, color: MUTED }}>{s.label}</div>
            <div
              style={{
                display: "flex",
                marginTop: 8,
                fontFamily: fonts.mono,
                fontSize: 52,
                fontWeight: 600,
                letterSpacing: "-0.03em",
              }}
            >
              {s.value}
            </div>
            <div style={{ display: "flex", marginTop: 6, fontFamily: fonts.mono, fontSize: 24, color: s.color }}>
              {s.detail ?? " "}
            </div>
          </div>
        ))}
      </div>
    </ShareFrame>
  );
}

export function QuarterStripCard({
  eyebrow,
  ticker,
  points,
  fonts,
}: {
  eyebrow: string;
  ticker: string;
  points: QuarterPoint[];
  fonts: CardFonts;
}) {
  const max = Math.max(...points.map((p) => p.revenue), 1);
  return (
    <ShareFrame
      eyebrow={eyebrow}
      title={`$${ticker}`}
      subtitle="Eight quarters"
      note="Revenue bars. Operating margin underneath."
      fonts={fonts}
    >
      <div style={{ display: "flex", alignItems: "flex-end", height: 640, marginTop: 48 }}>
        {points.map((p, i) => (
          <div
            key={`${p.label}-${i}`}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "flex-end",
              width: `${100 / points.length}%`,
              height: "100%",
            }}
          >
            <div
              style={{
                display: "flex",
                width: 36,
                height: Math.max(8, Math.round((p.revenue / max) * 460)),
                background: "#D4D4D4",
                borderRadius: 6,
              }}
            />
            <div style={{ display: "flex", marginTop: 14, fontFamily: fonts.mono, fontSize: 18, color: MUTED }}>
              {p.label}
            </div>
            <div
              style={{
                display: "flex",
                marginTop: 6,
                fontFamily: fonts.mono,
                fontSize: 18,
                color: p.operatingMargin === null ? DIM : TEXT,
              }}
            >
              {p.operatingMargin === null ? "-" : pct(p.operatingMargin)}
            </div>
          </div>
        ))}
      </div>
    </ShareFrame>
  );
}

export function SurpriseCard({
  eyebrow,
  ticker,
  fiscalLabel,
  surprise,
  fonts,
}: {
  eyebrow: string;
  ticker: string;
  fiscalLabel: string;
  surprise: Surprise;
  fonts: CardFonts;
}) {
  const rows = [
    surprise.eps === null ? null : { label: "EPS vs estimate", value: signedPct(surprise.eps), color: tone(surprise.eps) },
    surprise.revenue === null
      ? null
      : { label: "Revenue vs estimate", value: signedPct(surprise.revenue), color: tone(surprise.revenue) },
  ].filter((r): r is { label: string; value: string; color: string } => r !== null);
  return (
    <ShareFrame eyebrow={eyebrow} title={`$${ticker}`} subtitle={fiscalLabel} note="Actual versus the estimate stored before the print." fonts={fonts}>
      <div style={{ display: "flex", flexDirection: "column", marginTop: 64 }}>
        {rows.map((r) => (
          <div key={r.label} style={{ display: "flex", flexDirection: "column", marginTop: 36 }}>
            <div style={{ display: "flex", fontFamily: fonts.mono, fontSize: 22, color: MUTED }}>{r.label}</div>
            <div style={{ display: "flex", marginTop: 8, fontFamily: fonts.mono, fontSize: 92, fontWeight: 600, color: r.color }}>
              {r.value}
            </div>
          </div>
        ))}
      </div>
    </ShareFrame>
  );
}

export function MixCard({
  eyebrow,
  ticker,
  fiscalLabel,
  rows,
  fonts,
}: {
  eyebrow: string;
  ticker: string;
  fiscalLabel: string;
  rows: MixRow[];
  fonts: CardFonts;
}) {
  return (
    <ShareFrame eyebrow={eyebrow} title={`$${ticker}`} subtitle={`${fiscalLabel} revenue mix`} note="Product segments. Share of revenue, versus last year." fonts={fonts}>
      <div style={{ display: "flex", flexDirection: "column", marginTop: 36 }}>
        {rows.map((r) => (
          <div key={r.name} style={{ display: "flex", flexDirection: "column", marginTop: 22 }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <div style={{ display: "flex", fontSize: 28, fontWeight: 800 }}>{r.name}</div>
              <div style={{ display: "flex", fontFamily: fonts.mono, fontSize: 24 }}>
                {pct(r.share)}
                {r.priorShare === null ? "" : `  ${signedPp((r.share - r.priorShare) * 100)}`}
              </div>
            </div>
            <div style={{ display: "flex", marginTop: 8, height: 16, background: "#262626", borderRadius: 8 }}>
              <div
                style={{
                  display: "flex",
                  width: `${Math.max(2, Math.round(r.share * 100))}%`,
                  height: 16,
                  background: MINT,
                  borderRadius: 8,
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </ShareFrame>
  );
}

export function RankCard({
  eyebrow,
  title,
  subtitle,
  rows,
  format,
  note,
  fonts,
}: {
  eyebrow: string;
  title: string;
  subtitle?: string | null;
  rows: RankRow[];
  format: (value: number) => string;
  note: string;
  fonts: CardFonts;
}) {
  return (
    <ShareFrame eyebrow={eyebrow} title={title} subtitle={subtitle} note={note} fonts={fonts}>
      <div style={{ display: "flex", flexDirection: "column", marginTop: 28 }}>
        {rows.map((r) => (
          <div
            key={r.ticker}
            style={{ display: "flex", justifyContent: "space-between", marginTop: 16, alignItems: "baseline" }}
          >
            <div style={{ display: "flex", fontFamily: fonts.mono, fontSize: 32, fontWeight: 600 }}>${r.ticker}</div>
            <div style={{ display: "flex", fontFamily: fonts.mono, fontSize: 32, color: tone(r.value) }}>{format(r.value)}</div>
          </div>
        ))}
      </div>
    </ShareFrame>
  );
}

export function WorkforceListCard({
  eyebrow,
  title,
  rows,
  line,
  note,
  fonts,
}: {
  eyebrow: string;
  title: string;
  rows: WorkforceRow[];
  line: (row: WorkforceRow) => { value: string; color: string };
  note: string;
  fonts: CardFonts;
}) {
  return (
    <ShareFrame eyebrow={eyebrow} title={title} note={note} fonts={fonts}>
      <div style={{ display: "flex", flexDirection: "column", marginTop: 28 }}>
        {rows.map((r) => {
          const shown = line(r);
          return (
            <div
              key={r.ticker}
              style={{ display: "flex", justifyContent: "space-between", marginTop: 14, alignItems: "baseline" }}
            >
              <div style={{ display: "flex", fontFamily: fonts.mono, fontSize: 30, fontWeight: 600 }}>${r.ticker}</div>
              <div style={{ display: "flex", fontFamily: fonts.mono, fontSize: 30, color: shown.color }}>{shown.value}</div>
            </div>
          );
        })}
      </div>
    </ShareFrame>
  );
}

export function PickResultCard({
  ticker,
  returnLabel,
  revenueLabel,
  fonts,
}: {
  ticker: string;
  returnLabel: string;
  revenueLabel: string;
  fonts: CardFonts;
}) {
  return (
    <ShareFrame eyebrow="Since we picked it" title={`$${ticker}`} note="Not investment advice." fonts={fonts}>
      <div style={{ display: "flex", flexDirection: "column", marginTop: 48 }}>
        <div style={{ display: "flex", fontFamily: fonts.mono, fontSize: 22, color: "#A3A3A3" }}>Return</div>
        <div style={{ display: "flex", marginTop: 8, fontFamily: fonts.mono, fontSize: 72, fontWeight: 600 }}>
          {returnLabel}
        </div>
        <div style={{ display: "flex", marginTop: 36, fontFamily: fonts.mono, fontSize: 22, color: "#A3A3A3" }}>
          Revenue
        </div>
        <div style={{ display: "flex", marginTop: 8, fontFamily: fonts.mono, fontSize: 72, fontWeight: 600 }}>
          {revenueLabel}
        </div>
      </div>
    </ShareFrame>
  );
}
