import {
  buildIncomeFlow,
  priorPeriod,
  type IncomeFlow,
  type PeriodType,
  type StoredStatement,
} from "./model";
import { money, pct, signedPct, signedPp } from "./format";

export type IncomePayload = {
  ticker: string;
  name: string | null;
  sector: string | null;
  held: boolean;
  period_type: PeriodType;
  statements: StoredStatement[];
};

export type IncomeVisual = {
  payload: IncomePayload;
  statement: StoredStatement;
  prior: StoredStatement | null;
  flow: IncomeFlow;
};

export const TICKER_PATTERN = /^[A-Z0-9.\-]{1,10}$/;

/** The visual for a stored period (default: the latest), or null if it cannot balance. */
export function incomeVisualFrom(
  payload: IncomePayload,
  period?: string | null,
): IncomeVisual | null {
  const statement = period
    ? payload.statements.find((s) => s.period === period)
    : payload.statements[0];
  if (!statement) return null;
  const prior = priorPeriod(statement, payload.statements);
  const flow = buildIncomeFlow(statement, prior);
  return flow ? { payload, statement, prior, flow } : null;
}

/**
 * The post that carries the image. Deterministic — no model — because it
 * auto-publishes: every figure is read off the same flow the image draws, so
 * the text cannot say something the picture does not.
 *
 * No link. A post with a URL costs over ten times one without, and the image
 * already carries the domain.
 */
export function incomeVisualPostText(visual: IncomeVisual): string {
  const { payload, statement, flow } = visual;
  const m = flow.metrics;
  const withChange = (base: string, change: string | null) =>
    change === null ? base : `${base} (${change})`;

  const lines = [`$${payload.ticker} ${statement.fiscal_label} income statement`, ""];
  lines.push(
    withChange(
      `Revenue ${money(flow.revenue, flow.currency)}`,
      m.revenueYoy === null ? null : `${signedPct(m.revenueYoy)} Y/Y`,
    ),
  );
  if (m.grossMargin !== null) {
    lines.push(
      withChange(
        `Gross margin ${pct(m.grossMargin)}`,
        m.grossMarginPriorPp === null ? null : signedPp(m.grossMarginPriorPp),
      ),
    );
  }
  if (m.operatingMargin !== null) {
    lines.push(
      withChange(
        `Operating margin ${pct(m.operatingMargin)}`,
        m.operatingMarginPriorPp === null ? null : signedPp(m.operatingMarginPriorPp),
      ),
    );
  }
  lines.push(
    m.netIncome > 0
      ? withChange(
          `Net income ${money(m.netIncome, flow.currency)}`,
          m.netIncomeYoy === null ? null : `${signedPct(m.netIncomeYoy)} Y/Y`,
        )
      : `Net loss ${money(-m.netIncome, flow.currency)}`,
  );
  return lines.join("\n");
}

export function incomeVisualKey(ticker: string, periodType: PeriodType, period: string): string {
  return `${ticker}:${periodType}:${period}`;
}

export function incomeVisualDedupeKey(visual: IncomeVisual): string {
  return incomeVisualKey(
    visual.payload.ticker,
    visual.statement.period_type,
    visual.statement.period,
  );
}
