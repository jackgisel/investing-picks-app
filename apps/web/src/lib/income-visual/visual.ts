import {
  buildIncomeFlow,
  priorPeriod,
  type IncomeFlow,
  type PeriodType,
  type StoredStatement,
} from "./model";
import {
  incomeVisualCaption,
  type EarningsPrint,
  type MixRow,
  type Surprise,
} from "./graphics";

export type IncomePayload = {
  ticker: string;
  name: string | null;
  sector: string | null;
  held: boolean;
  period_type: PeriodType;
  statements: StoredStatement[];
  earnings?: EarningsPrint[];
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
export function incomeVisualPostText(
  visual: IncomeVisual,
  extras?: { surprise?: Surprise | null; mix?: MixRow[] | null },
): string {
  return incomeVisualCaption(visual, extras);
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
