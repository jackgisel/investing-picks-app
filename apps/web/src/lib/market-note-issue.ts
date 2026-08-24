import { pool } from "@/lib/db";

/**
 * Issues of the free weekly Market Note.
 *
 * Split from `market-note.ts` the way `insights-db.ts` is split from
 * `insights.ts`: that module is about the subscriber list, this one is about
 * what gets mailed to it.
 *
 * Keyed by ISO week rather than by date so a compose page opened twice in one
 * week edits one issue instead of creating two, and so the dispatch ledger key
 * and the row key are the same string.
 */

export type MarketNoteIssue = {
  id: string;
  weekKey: string;
  subject: string;
  lede: string | null;
  bodyMd: string | null;
  confirmedAt: string | null;
  sentAt: string | null;
  recipients: number;
  createdAt: string;
  updatedAt: string;
};

type Row = {
  id: string;
  week_key: string;
  subject: string;
  lede: string | null;
  body_md: string | null;
  confirmed_at: Date | null;
  sent_at: Date | null;
  recipients: number;
  created_at: Date;
  updated_at: Date;
};

const COLUMNS = `id, week_key, subject, lede, body_md, confirmed_at, sent_at,
  recipients, created_at, updated_at`;

function toIssue(r: Row): MarketNoteIssue {
  return {
    id: String(r.id),
    weekKey: r.week_key,
    subject: r.subject,
    lede: r.lede,
    bodyMd: r.body_md,
    confirmedAt: r.confirmed_at ? r.confirmed_at.toISOString() : null,
    sentAt: r.sent_at ? r.sent_at.toISOString() : null,
    recipients: r.recipients,
    createdAt: r.created_at.toISOString(),
    updatedAt: r.updated_at.toISOString(),
  };
}

export async function listIssues(limit = 20): Promise<MarketNoteIssue[]> {
  const { rows } = await pool.query<Row>(
    `SELECT ${COLUMNS} FROM market_note_issue
      ORDER BY created_at DESC LIMIT $1`,
    [limit],
  );
  return rows.map(toIssue);
}

export async function getIssueByWeek(
  weekKey: string,
): Promise<MarketNoteIssue | null> {
  const { rows } = await pool.query<Row>(
    `SELECT ${COLUMNS} FROM market_note_issue WHERE week_key = $1`,
    [weekKey],
  );
  return rows[0] ? toIssue(rows[0]) : null;
}

export async function getIssueById(
  id: string,
): Promise<MarketNoteIssue | null> {
  const { rows } = await pool.query<Row>(
    `SELECT ${COLUMNS} FROM market_note_issue WHERE id = $1`,
    [id],
  );
  return rows[0] ? toIssue(rows[0]) : null;
}

/** Create this week's issue, or return the one that already exists. */
export async function ensureIssue(
  weekKey: string,
  subject: string,
): Promise<MarketNoteIssue> {
  const { rows } = await pool.query<Row>(
    `INSERT INTO market_note_issue (week_key, subject)
     VALUES ($1, $2)
     ON CONFLICT (week_key) DO UPDATE SET updated_at = NOW()
     RETURNING ${COLUMNS}`,
    [weekKey, subject],
  );
  return toIssue(rows[0]);
}

/**
 * Save edits. Refuses once the issue has gone out — there is no un-send, and an
 * archive that no longer matches what landed in inboxes is worse than none.
 */
export async function saveIssue(
  id: string,
  fields: { subject: string; lede: string | null; bodyMd: string | null },
): Promise<MarketNoteIssue | null> {
  const { rows } = await pool.query<Row>(
    `UPDATE market_note_issue
        SET subject = $2, lede = $3, body_md = $4, updated_at = NOW()
      WHERE id = $1 AND sent_at IS NULL
      RETURNING ${COLUMNS}`,
    [id, fields.subject, fields.lede, fields.bodyMd],
  );
  return rows[0] ? toIssue(rows[0]) : null;
}

/** Mark an issue ready to send, or withdraw that. */
export async function setConfirmed(
  id: string,
  on: boolean,
): Promise<MarketNoteIssue | null> {
  const { rows } = await pool.query<Row>(
    `UPDATE market_note_issue
        SET confirmed_at = ${on ? "NOW()" : "NULL"}, updated_at = NOW()
      WHERE id = $1 AND sent_at IS NULL
      RETURNING ${COLUMNS}`,
    [id],
  );
  return rows[0] ? toIssue(rows[0]) : null;
}

/**
 * The issue the Monday job should send, if any.
 *
 * Deliberately NOT "the issue whose week_key is this week". ISO weeks run
 * Monday–Sunday, so anything written over the weekend keys to the week that is
 * ending while the send fires on the week that is starting — matching on the
 * key would skip exactly the issues written when they are most likely to be
 * written. Oldest first, so a week that was missed goes out before a newer one
 * rather than being stranded behind it.
 */
export async function getSendableIssue(): Promise<MarketNoteIssue | null> {
  const { rows } = await pool.query<Row>(
    `SELECT ${COLUMNS} FROM market_note_issue
      WHERE confirmed_at IS NOT NULL
        AND sent_at IS NULL
        AND body_md IS NOT NULL
        AND btrim(body_md) <> ''
      ORDER BY created_at ASC
      LIMIT 1`,
  );
  return rows[0] ? toIssue(rows[0]) : null;
}

/**
 * Claim the right to send. Succeeds for exactly one caller.
 *
 * The same conditional-UPDATE shape as `claimForPublish`: stamping `sent_at` in
 * the statement that authorises the send is what makes a double-click or two
 * overlapping jobs produce one mailing rather than two. The dispatch ledger is
 * a second belt on top of this.
 */
export async function claimIssueForSend(
  id: string,
  recipients: number,
): Promise<MarketNoteIssue | null> {
  const { rows } = await pool.query<Row>(
    `UPDATE market_note_issue
        SET sent_at = NOW(), recipients = $2, updated_at = NOW()
      WHERE id = $1
        AND sent_at IS NULL
        AND confirmed_at IS NOT NULL
        AND body_md IS NOT NULL
      RETURNING ${COLUMNS}`,
    [id, recipients],
  );
  return rows[0] ? toIssue(rows[0]) : null;
}
