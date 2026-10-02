import type { FlowNode, IncomeFlow, StoredStatement } from "./model";
import { columnStep, layoutIncomeFlow, type LayoutOptions } from "./layout";
import { longDate, money, pct, shortCompanyName, signedPct } from "./format";

/**
 * The income-statement card, square, in satori's dialect: every element with
 * more than one child is `display: flex`, all positioning is absolute pixels,
 * and the Sankey itself is an inline SVG with no text in it — satori does not
 * render SVG `<text>`, so labels are HTML laid over the chart.
 */

export const CARD_SIZE = 1080;

const BG = "#0A0A0A";
const TEXT = "#FAFAFA";
const MUTED = "#A3A3A3";
const DIM = "#737373";
const MINT = "#A8D9A0";
const CORAL = "#F07167";

const NODE_FILL = {
  revenue: "#8C8C8C",
  profit: "#22C55E",
  cost: "#EF4444",
  loss: "#EF4444",
} as const;
const LINK_FILL = {
  revenue: "rgba(163,163,163,0.42)",
  profit: "rgba(74,222,128,0.46)",
  cost: "rgba(240,113,103,0.44)",
  loss: "rgba(240,113,103,0.44)",
} as const;
const NAME_COLOR = { revenue: TEXT, profit: MINT, cost: CORAL, loss: CORAL } as const;

const PAD_X = 48;
const PAD_Y = 52;
const HEADER_H = 232;
const FOOTER_H = 34;
const CHART_W = CARD_SIZE - PAD_X * 2;
const CHART_H = CARD_SIZE - PAD_Y * 2 - HEADER_H - FOOTER_H - 20;

const NAME_PX = 17;
const NAME_LH = 21;
const VALUE_PX = 20;
const VALUE_LH = 25;
const DETAIL_PX = 14;
const DETAIL_LH = 18;
const LABEL_GAP = 10;
const SIDE_LABEL_W = 176;
const NODE_W = 20;

export type CardFonts = { sans: string; mono: string };

type Detail = { text: string; color: string };

function details(n: FlowNode): Detail[] {
  const out: Detail[] = [];
  if (n.margin !== null) out.push({ text: `${pct(n.margin)} margin`, color: MUTED });
  if (n.yoy !== null) {
    const good = n.kind === "cost" ? MUTED : n.yoy >= 0 ? MINT : CORAL;
    out.push({ text: `${signedPct(n.yoy)} Y/Y`, color: good });
  }
  return out;
}

function labelWidth(n: FlowNode, step: number, columns: number): number {
  const side = n.column === 0 || n.column === columns - 1;
  return side ? SIDE_LABEL_W - LABEL_GAP : Math.max(step - NODE_W - LABEL_GAP * 2, 104);
}

function nameLines(n: FlowNode, width: number): number {
  // Outfit 800 averages a little over half an em per glyph.
  return Math.min(3, Math.max(1, Math.ceil((n.label.length * NAME_PX * 0.57) / width)));
}

function labelHeight(n: FlowNode, step: number, columns: number): number {
  const width = labelWidth(n, step, columns);
  return nameLines(n, width) * NAME_LH + VALUE_LH + details(n).length * DETAIL_LH;
}

function periodLine(st: StoredStatement): string {
  const end = longDate(st.period);
  const filed = longDate(st.accepted_date);
  const what = st.period_type === "annual" ? "Fiscal year ended" : "Quarter ended";
  return [end ? `${what} ${end}` : null, filed ? `Filed ${filed}` : null]
    .filter(Boolean)
    .join("  /  ");
}

function Mark({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <path
        d="M21.2 5.4A11 11 0 1 0 26.6 11.2"
        stroke={TEXT}
        strokeWidth="2.6"
        strokeLinecap="round"
      />
      <circle cx="25.8" cy="6.2" r="2.35" fill={MINT} />
    </svg>
  );
}

export function IncomeVisualCard({
  ticker,
  name,
  statement,
  flow,
  fonts,
}: {
  ticker: string;
  name: string | null;
  statement: StoredStatement;
  flow: IncomeFlow;
  fonts: CardFonts;
}) {
  const options: LayoutOptions = {
    width: CHART_W,
    height: CHART_H,
    nodeWidth: NODE_W,
    sideLabelWidth: SIDE_LABEL_W,
    labelHeight: (n, step) => labelHeight(n, step, flow.columns),
    gap: 12,
    spread: 26,
  };
  const layout = layoutIncomeFlow(flow, options);
  const step = columnStep(flow.columns, options);
  const company = shortCompanyName(name, ticker);
  const titlePx = company.length > 22 ? 50 : company.length > 16 ? 60 : 70;

  return (
    <div
      style={{
        width: CARD_SIZE,
        height: CARD_SIZE,
        display: "flex",
        flexDirection: "column",
        background: BG,
        padding: `${PAD_Y}px ${PAD_X}px`,
        fontFamily: fonts.sans,
        color: TEXT,
      }}
    >
      <div style={{ height: HEADER_H, display: "flex", flexDirection: "column" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div
            style={{
              display: "flex",
              fontFamily: fonts.mono,
              fontSize: 22,
              fontWeight: 600,
              color: TEXT,
              border: "1.5px solid #333333",
              borderRadius: 10,
              padding: "4px 12px",
            }}
          >
            ${ticker}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Mark size={28} />
            <div
              style={{
                display: "flex",
                fontSize: 18,
                fontWeight: 800,
                letterSpacing: "0.14em",
              }}
            >
              OUTPICK
            </div>
          </div>
        </div>
        <div
          style={{
            display: "flex",
            marginTop: 22,
            fontSize: titlePx,
            fontWeight: 800,
            letterSpacing: "-0.03em",
            lineHeight: 1.05,
          }}
        >
          {company}
        </div>
        <div
          style={{
            display: "flex",
            marginTop: 6,
            fontSize: 44,
            fontWeight: 500,
            letterSpacing: "-0.02em",
            lineHeight: 1.1,
          }}
        >
          <span style={{ color: MINT, marginRight: 14 }}>{statement.fiscal_label}</span>
          <span>Income Statement</span>
        </div>
        <div
          style={{
            display: "flex",
            marginTop: 12,
            fontFamily: fonts.mono,
            fontSize: 16,
            fontWeight: 500,
            color: MUTED,
          }}
        >
          {periodLine(statement)}
        </div>
      </div>

      <div
        style={{
          position: "relative",
          display: "flex",
          width: CHART_W,
          height: CHART_H,
          marginTop: 20,
        }}
      >
        <svg
          width={CHART_W}
          height={CHART_H}
          viewBox={`0 0 ${CHART_W} ${CHART_H}`}
          style={{ position: "absolute", left: 0, top: 0 }}
        >
          {layout.links.map((l) => (
            <path key={`${l.source}>${l.target}`} d={l.d} fill={LINK_FILL[l.kind]} />
          ))}
          {layout.nodes.map((n) =>
            n.kind === "loss" ? (
              <rect
                key={n.id}
                x={n.x + 1}
                y={n.y - 9}
                width={NODE_W - 2}
                height={18}
                fill="none"
                stroke={NODE_FILL.loss}
                strokeWidth={2}
                strokeDasharray="4 3"
              />
            ) : (
              <rect
                key={n.id}
                x={n.x}
                y={n.y}
                width={NODE_W}
                height={n.h}
                fill={NODE_FILL[n.kind]}
              />
            ),
          )}
        </svg>

        {layout.nodes.map((n) => {
          const width = labelWidth(n, step, flow.columns);
          const height = labelHeight(n, step, flow.columns);
          const centerY = n.y + n.h / 2;
          const left =
            n.labelSide === "left" ? n.x - LABEL_GAP - width : n.x + NODE_W + LABEL_GAP;
          const middle = n.column !== 0 && n.column !== flow.columns - 1;
          const align = n.labelSide === "left" ? "flex-end" : "flex-start";
          return (
            <div
              key={`label:${n.id}`}
              style={{
                position: "absolute",
                left,
                top: centerY - height / 2,
                width,
                display: "flex",
                flexDirection: "column",
                alignItems: align,
              }}
            >
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: align,
                  background: middle ? "rgba(10,10,10,0.72)" : "transparent",
                  borderRadius: 6,
                  padding: middle ? "0 6px" : 0,
                  marginLeft: middle ? -6 : 0,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    fontSize: NAME_PX,
                    lineHeight: `${NAME_LH}px`,
                    fontWeight: 800,
                    color: NAME_COLOR[n.kind],
                    textAlign: n.labelSide === "left" ? "right" : "left",
                    maxWidth: width,
                  }}
                >
                  {n.label}
                </div>
                <div
                  style={{
                    display: "flex",
                    fontFamily: fonts.mono,
                    fontSize: VALUE_PX,
                    lineHeight: `${VALUE_LH}px`,
                    fontWeight: 600,
                    color: n.kind === "loss" ? CORAL : TEXT,
                  }}
                >
                  {money(n.value, flow.currency)}
                </div>
                {details(n).map((d) => (
                  <div
                    key={d.text}
                    style={{
                      display: "flex",
                      fontFamily: fonts.mono,
                      fontSize: DETAIL_PX,
                      lineHeight: `${DETAIL_LH}px`,
                      fontWeight: 500,
                      color: d.color,
                    }}
                  >
                    {d.text}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-end",
          height: FOOTER_H,
          fontFamily: fonts.mono,
          fontSize: 14,
          fontWeight: 500,
          color: DIM,
        }}
      >
        <div style={{ display: "flex" }}>
          Source: company filings via FMP. Not investment advice.
        </div>
        <div style={{ display: "flex", color: MUTED }}>outpick.xyz</div>
      </div>
    </div>
  );
}
