import { pool } from "@/lib/db";

/**
 * The two free letters that are not the Monday note: twice-monthly market
 * analysis, and the Wednesday spotlight of one holding that has been working.
 *
 * Same confirm-then-send shape as the Monday note. `period_key` is the ISO
 * week for a spotlight and `YYYY-MM-01` / `YYYY-MM-15` for an analysis.
 */

export type EditorialKind = "market_analysis" | "pick_spotlight";

export type EditorialIssue = {
  id: string;
  kind: EditorialKind;
  periodKey: string;
  subject: string;
  bodyMd: string;
  ticker: string | null;
  confirmedAt: string | null;
  sentAt: string | null;
  recipients: number;
  createdAt: string;
  updatedAt: string;
};

type Row = {
  id: string;
  kind: EditorialKind;
  period_key: string;
  subject: string;
  body_md: string;
  ticker: string | null;
  confirmed_at: Date | null;
  sent_at: Date | null;
  recipients: number;
  created_at: Date;
  updated_at: Date;
};

const COLUMNS = `id, kind, period_key, subject, body_md, ticker, confirmed_at,
  sent_at, recipients, created_at, updated_at`;

function toIssue(row: Row): EditorialIssue {
  return {
    id: String(row.id),
    kind: row.kind,
    periodKey: row.period_key,
    subject: row.subject,
    bodyMd: row.body_md,
    ticker: row.ticker,
    confirmedAt: row.confirmed_at ? row.confirmed_at.toISOString() : null,
    sentAt: row.sent_at ? row.sent_at.toISOString() : null,
    recipients: row.recipients,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

export async function listEditorialIssues(limit = 20): Promise<EditorialIssue[]> {
  const { rows } = await pool.query<Row>(
    `SELECT ${COLUMNS} FROM editorial_issue ORDER BY created_at DESC LIMIT $1`,
    [limit],
  );
  return rows.map(toIssue);
}

export async function getEditorialIssue(id: string): Promise<EditorialIssue | null> {
  const { rows } = await pool.query<Row>(
    `SELECT ${COLUMNS} FROM editorial_issue WHERE id = $1`,
    [id],
  );
  return rows[0] ? toIssue(rows[0]) : null;
}

export async function getEditorialByPeriod(
  kind: EditorialKind,
  periodKey: string,
): Promise<EditorialIssue | null> {
  const { rows } = await pool.query<Row>(
    `SELECT ${COLUMNS} FROM editorial_issue WHERE kind = $1 AND period_key = $2`,
    [kind, periodKey],
  );
  return rows[0] ? toIssue(rows[0]) : null;
}

export async function ensureEditorialIssue(args: {
  kind: EditorialKind;
  periodKey: string;
  subject: string;
}): Promise<EditorialIssue> {
  const { rows } = await pool.query<Row>(
    `INSERT INTO editorial_issue (kind, period_key, subject)
     VALUES ($1, $2, $3)
     ON CONFLICT (kind, period_key) DO UPDATE SET updated_at = NOW()
     RETURNING ${COLUMNS}`,
    [args.kind, args.periodKey, args.subject],
  );
  return toIssue(rows[0]);
}

export async function saveEditorialIssue(
  id: string,
  fields: { subject: string; bodyMd: string; ticker: string | null },
): Promise<EditorialIssue | null> {
  const { rows } = await pool.query<Row>(
    `UPDATE editorial_issue
        SET subject = $2, body_md = $3, ticker = $4, updated_at = NOW()
      WHERE id = $1 AND sent_at IS NULL
      RETURNING ${COLUMNS}`,
    [id, fields.subject, fields.bodyMd, fields.ticker],
  );
  return rows[0] ? toIssue(rows[0]) : null;
}

export async function setEditorialConfirmed(
  id: string,
  on: boolean,
): Promise<EditorialIssue | null> {
  const { rows } = await pool.query<Row>(
    `UPDATE editorial_issue
        SET confirmed_at = ${on ? "NOW()" : "NULL"}, updated_at = NOW()
      WHERE id = $1 AND sent_at IS NULL
      RETURNING ${COLUMNS}`,
    [id],
  );
  return rows[0] ? toIssue(rows[0]) : null;
}

export async function claimEditorialForSend(
  id: string,
  recipients: number,
): Promise<EditorialIssue | null> {
  const { rows } = await pool.query<Row>(
    `UPDATE editorial_issue
        SET sent_at = NOW(), recipients = $2, updated_at = NOW()
      WHERE id = $1
        AND confirmed_at IS NOT NULL
        AND sent_at IS NULL
        AND btrim(body_md) <> ''
      RETURNING ${COLUMNS}`,
    [id, recipients],
  );
  return rows[0] ? toIssue(rows[0]) : null;
}

export async function latestSpotlightTicker(): Promise<string | null> {
  const { rows } = await pool.query<{ ticker: string | null }>(
    `SELECT ticker FROM editorial_issue
      WHERE kind = 'pick_spotlight' AND ticker IS NOT NULL
      ORDER BY created_at DESC
      LIMIT 1`,
  );
  return rows[0]?.ticker ?? null;
}
