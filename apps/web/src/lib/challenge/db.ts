import { randomBytes } from "crypto";
import { pool } from "@/lib/db";
import {
  BENCHMARK,
  cohortFor,
  MIN_MARKET_CAP,
  nyDate,
  pickGrowth,
} from "@/lib/challenge/rules";

/**
 * Reads and writes for the Beat the S&P challenge.
 *
 * Entries live in `challenge_entry` / `challenge_pick` (created by
 * runAppMigrations). Prices come from `challenge_price`, which the worker
 * fills each weeknight. Every score is computed on read from those two, so
 * there is no stored number that can drift from the prices behind it.
 *
 * An entry starts at the first SPY close dated after its New York submission
 * date. Until that close is loaded it is "pending" and has no score.
 */

export type EligibleStock = {
  ticker: string;
  name: string | null;
  sector: string | null;
  industry: string | null;
  market_cap: number | null;
};

const ELIGIBLE_WHERE = `is_active AND NOT is_etf AND market_cap >= ${MIN_MARKET_CAP}`;

/** Ticker or name search over the eligible universe, best match first. */
export async function searchEligible(q: string, limit = 8): Promise<EligibleStock[]> {
  const term = q.trim().slice(0, 40);
  if (!term) return [];
  const upper = term.toUpperCase();
  const { rows } = await pool.query<EligibleStock>(
    `SELECT ticker, name, sector, industry, market_cap
       FROM stocks
      WHERE ${ELIGIBLE_WHERE}
        AND (ticker LIKE $1 || '%' OR name ILIKE '%' || $2 || '%')
      ORDER BY (ticker = $1) DESC, (ticker LIKE $1 || '%') DESC,
               market_cap DESC NULLS LAST
      LIMIT $3`,
    [upper, term.replace(/[%_\\]/g, ""), limit],
  );
  return rows.map(numericCap);
}

/** The subset of `tickers` that is in the eligible universe, with details. */
export async function eligibleStocks(tickers: string[]): Promise<EligibleStock[]> {
  if (tickers.length === 0) return [];
  const { rows } = await pool.query<EligibleStock>(
    `SELECT ticker, name, sector, industry, market_cap
       FROM stocks WHERE ${ELIGIBLE_WHERE} AND ticker = ANY($1)`,
    [tickers],
  );
  return rows.map(numericCap);
}

function numericCap<T extends { market_cap: unknown }>(r: T): T & { market_cap: number | null } {
  return { ...r, market_cap: r.market_cap === null ? null : Number(r.market_cap) };
}

function newEntryId(): string {
  return randomBytes(6).toString("base64url");
}

export type CreateResult =
  | { ok: true; id: string }
  | { ok: false; existingId: string };

/** Lock in an entry. One per user per calendar quarter. */
export async function createEntry(input: {
  userId: string;
  displayName: string;
  tickers: string[];
  now?: Date;
}): Promise<CreateResult> {
  const submittedOn = nyDate(input.now ?? new Date());
  const cohort = cohortFor(submittedOn);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const existing = await client.query<{ id: string }>(
      `SELECT id FROM challenge_entry WHERE user_id = $1 AND cohort = $2`,
      [input.userId, cohort],
    );
    if (existing.rows[0]) {
      await client.query("ROLLBACK");
      return { ok: false, existingId: existing.rows[0].id };
    }
    const id = newEntryId();
    await client.query(
      `INSERT INTO challenge_entry (id, user_id, display_name, cohort, submitted_on)
       VALUES ($1, $2, $3, $4, $5)`,
      [id, input.userId, input.displayName, cohort, submittedOn],
    );
    await client.query(
      `INSERT INTO challenge_pick (entry_id, ticker) SELECT $1, unnest($2::text[])`,
      [id, input.tickers],
    );
    await client.query("COMMIT");
    return { ok: true, id };
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {});
    // Two tabs submitting at once: the unique constraint is the real guard.
    if ((e as { code?: string }).code === "23505") {
      const again = await pool.query<{ id: string }>(
        `SELECT id FROM challenge_entry WHERE user_id = $1 AND cohort = $2`,
        [input.userId, cohort],
      );
      if (again.rows[0]) return { ok: false, existingId: again.rows[0].id };
    }
    throw e;
  } finally {
    client.release();
  }
}

export type UserEntry = { id: string; cohort: string; submitted_on: string };

export async function getUserEntries(userId: string): Promise<UserEntry[]> {
  const { rows } = await pool.query<UserEntry>(
    `SELECT id, cohort, to_char(submitted_on, 'YYYY-MM-DD') AS submitted_on
       FROM challenge_entry WHERE user_id = $1 ORDER BY submitted_on DESC`,
    [userId],
  );
  return rows;
}

/** True once the worker's price table exists, i.e. the API has deployed. */
async function pricesReady(): Promise<boolean> {
  const { rows } = await pool.query<{ ok: boolean }>(
    `SELECT to_regclass('challenge_price') IS NOT NULL AS ok`,
  );
  return Boolean(rows[0]?.ok);
}

export type PriceBasis = "total_return" | "price" | null;

async function priceBasis(): Promise<PriceBasis> {
  const { rows } = await pool.query<{ basis: string }>(
    `SELECT basis FROM challenge_price_checks WHERE ticker = $1`,
    [BENCHMARK],
  );
  const b = rows[0]?.basis;
  return b === "total_return" || b === "price" ? b : null;
}

export type BoardRow = {
  id: string;
  display_name: string;
  cohort: string;
  submitted_on: string;
  /** First session, or null while the entry is waiting for its first close. */
  start_date: string | null;
  picks: number;
  ret: number | null;
  spy_ret: number | null;
  excess: number | null;
};

export type Board = {
  as_of: string | null;
  basis: PriceBasis;
  rows: BoardRow[];
};

const ENTRY_START = `(SELECT MIN(cp.date) FROM challenge_price cp
                       WHERE cp.ticker = '${BENCHMARK}' AND cp.date > e.submitted_on)`;

/**
 * Every visible entry, scored to the latest benchmark close. Started entries
 * are ranked by return minus SPY's return over the same window; pending ones
 * follow, newest first.
 */
export async function getBoard(opts: { cohort?: string | null } = {}): Promise<Board> {
  if (!(await pricesReady())) {
    const { rows } = await pool.query<BoardRow>(
      `SELECT id, display_name, cohort, to_char(submitted_on, 'YYYY-MM-DD') AS submitted_on,
              NULL AS start_date,
              (SELECT COUNT(*)::int FROM challenge_pick p WHERE p.entry_id = e.id) AS picks,
              NULL AS ret, NULL AS spy_ret, NULL AS excess
         FROM challenge_entry e
        WHERE NOT hidden AND ($1::text IS NULL OR cohort = $1)
        ORDER BY submitted_at DESC`,
      [opts.cohort ?? null],
    );
    return { as_of: null, basis: null, rows };
  }

  const { rows } = await pool.query<{
    id: string;
    display_name: string;
    cohort: string;
    submitted_on: string;
    start_date: string | null;
    picks: number;
    ret: string | null;
    spy_ret: string | null;
    as_of: string | null;
  }>(
    `WITH asof AS (
       SELECT MAX(date) AS d FROM challenge_price WHERE ticker = '${BENCHMARK}'
     ),
     entries AS (
       SELECT e.id, e.display_name, e.cohort, e.submitted_on, e.submitted_at,
              ${ENTRY_START} AS start_date
         FROM challenge_entry e
        WHERE NOT e.hidden AND ($1::text IS NULL OR e.cohort = $1)
     ),
     marks AS (
       SELECT en.id,
              (SELECT cp.close FROM challenge_price cp
                WHERE cp.ticker = p.ticker AND cp.date >= en.start_date
                ORDER BY cp.date LIMIT 1) AS start_close,
              (SELECT cp.close FROM challenge_price cp, asof
                WHERE cp.ticker = p.ticker AND cp.date <= asof.d
                ORDER BY cp.date DESC LIMIT 1) AS last_close
         FROM entries en
         JOIN challenge_pick p ON p.entry_id = en.id
        WHERE en.start_date IS NOT NULL
     ),
     agg AS (
       SELECT id,
              AVG(CASE WHEN start_close > 0 AND last_close > 0
                       THEN last_close / start_close ELSE 1 END) - 1 AS ret
         FROM marks GROUP BY id
     )
     SELECT en.id, en.display_name, en.cohort,
            to_char(en.submitted_on, 'YYYY-MM-DD') AS submitted_on,
            to_char(en.start_date, 'YYYY-MM-DD') AS start_date,
            (SELECT COUNT(*)::int FROM challenge_pick p WHERE p.entry_id = en.id) AS picks,
            agg.ret,
            (SELECT cp.close FROM challenge_price cp, asof
              WHERE cp.ticker = '${BENCHMARK}' AND cp.date = asof.d)
              / NULLIF((SELECT cp.close FROM challenge_price cp
                         WHERE cp.ticker = '${BENCHMARK}' AND cp.date = en.start_date), 0)
              - 1 AS spy_ret,
            to_char((SELECT d FROM asof), 'YYYY-MM-DD') AS as_of
       FROM entries en
       LEFT JOIN agg ON agg.id = en.id
      ORDER BY en.submitted_at DESC`,
    [opts.cohort ?? null],
  );

  const scored: BoardRow[] = rows.map((r) => {
    const ret = r.ret === null ? null : Number(r.ret);
    const spy = r.spy_ret === null ? null : Number(r.spy_ret);
    const started = r.start_date !== null && ret !== null && spy !== null;
    return {
      id: r.id,
      display_name: r.display_name,
      cohort: r.cohort,
      submitted_on: r.submitted_on,
      start_date: r.start_date,
      picks: r.picks,
      ret: started ? ret : null,
      spy_ret: started ? spy : null,
      excess: started ? ret! - spy! : null,
    };
  });
  scored.sort((a, b) => {
    if (a.excess !== null && b.excess !== null) return b.excess - a.excess;
    if (a.excess !== null) return -1;
    if (b.excess !== null) return 1;
    return b.submitted_on.localeCompare(a.submitted_on);
  });
  return {
    as_of: rows[0]?.as_of ?? (await latestClose()),
    basis: await priceBasis(),
    rows: scored,
  };
}

async function latestClose(): Promise<string | null> {
  const { rows } = await pool.query<{ d: string | null }>(
    `SELECT to_char(MAX(date), 'YYYY-MM-DD') AS d FROM challenge_price WHERE ticker = $1`,
    [BENCHMARK],
  );
  return rows[0]?.d ?? null;
}

export async function listCohorts(): Promise<string[]> {
  const { rows } = await pool.query<{ cohort: string }>(
    `SELECT DISTINCT cohort FROM challenge_entry WHERE NOT hidden ORDER BY cohort DESC`,
  );
  return rows.map((r) => r.cohort);
}

export type EntryPick = EligibleStock & {
  start: number | null;
  last: number | null;
  growth: number;
};

export type EntryDetail = {
  id: string;
  display_name: string;
  cohort: string;
  submitted_on: string;
  start_date: string | null;
  as_of: string | null;
  basis: PriceBasis;
  user_id: string;
  hidden: boolean;
  picks: EntryPick[];
  spy_start: number | null;
  spy_last: number | null;
};

export async function getEntry(id: string): Promise<EntryDetail | null> {
  if (!/^[A-Za-z0-9_-]{4,16}$/.test(id)) return null;
  const head = await pool.query<{
    id: string;
    display_name: string;
    cohort: string;
    submitted_on: string;
    user_id: string;
    hidden: boolean;
  }>(
    `SELECT id, display_name, cohort, to_char(submitted_on, 'YYYY-MM-DD') AS submitted_on,
            user_id, hidden
       FROM challenge_entry WHERE id = $1`,
    [id],
  );
  const entry = head.rows[0];
  if (!entry) return null;

  const ready = await pricesReady();
  const picks = await pool.query<{
    ticker: string;
    name: string | null;
    sector: string | null;
    industry: string | null;
    market_cap: string | null;
    start: string | null;
    last: string | null;
  }>(
    ready
      ? `WITH s AS (
           SELECT MIN(date) AS d FROM challenge_price
            WHERE ticker = '${BENCHMARK}' AND date > $2::date
         ), asof AS (
           SELECT MAX(date) AS d FROM challenge_price WHERE ticker = '${BENCHMARK}'
         )
         SELECT p.ticker, st.name, st.sector, st.industry, st.market_cap,
                (SELECT cp.close FROM challenge_price cp, s
                  WHERE cp.ticker = p.ticker AND cp.date >= s.d
                  ORDER BY cp.date LIMIT 1) AS start,
                (SELECT cp.close FROM challenge_price cp, asof
                  WHERE cp.ticker = p.ticker AND cp.date <= asof.d
                  ORDER BY cp.date DESC LIMIT 1) AS last
           FROM challenge_pick p
           LEFT JOIN stocks st ON st.ticker = p.ticker
          WHERE p.entry_id = $1`
      : `SELECT p.ticker, st.name, st.sector, st.industry, st.market_cap,
                NULL AS start, NULL AS last
           FROM challenge_pick p
           LEFT JOIN stocks st ON st.ticker = p.ticker
          WHERE p.entry_id = $1 AND $2::date IS NOT NULL`,
    [id, entry.submitted_on],
  );

  let start_date: string | null = null;
  let as_of: string | null = null;
  let spy_start: number | null = null;
  let spy_last: number | null = null;
  if (ready) {
    const spy = await pool.query<{
      start_date: string | null;
      as_of: string | null;
      spy_start: string | null;
      spy_last: string | null;
    }>(
      `WITH s AS (
         SELECT MIN(date) AS d FROM challenge_price
          WHERE ticker = '${BENCHMARK}' AND date > $1::date
       ), asof AS (
         SELECT MAX(date) AS d FROM challenge_price WHERE ticker = '${BENCHMARK}'
       )
       SELECT to_char(s.d, 'YYYY-MM-DD') AS start_date,
              to_char(asof.d, 'YYYY-MM-DD') AS as_of,
              (SELECT close FROM challenge_price WHERE ticker = '${BENCHMARK}' AND date = s.d) AS spy_start,
              (SELECT close FROM challenge_price WHERE ticker = '${BENCHMARK}' AND date = asof.d) AS spy_last
         FROM s, asof`,
      [entry.submitted_on],
    );
    const r = spy.rows[0];
    start_date = r?.start_date ?? null;
    as_of = start_date ? (r?.as_of ?? null) : null;
    spy_start = start_date && r?.spy_start ? Number(r.spy_start) : null;
    spy_last = start_date && r?.spy_last ? Number(r.spy_last) : null;
  }

  const rows: EntryPick[] = picks.rows.map((p) => {
    const mark = {
      ticker: p.ticker,
      start: start_date && p.start !== null ? Number(p.start) : null,
      last: start_date && p.last !== null ? Number(p.last) : null,
    };
    return {
      name: p.name,
      sector: p.sector,
      industry: p.industry,
      market_cap: p.market_cap === null ? null : Number(p.market_cap),
      ...mark,
      growth: pickGrowth(mark),
    };
  });
  rows.sort((a, b) => b.growth - a.growth || a.ticker.localeCompare(b.ticker));

  return {
    ...entry,
    start_date,
    as_of,
    basis: ready ? await priceBasis() : null,
    picks: rows,
    spy_start,
    spy_last,
  };
}

export type SeriesPoint = { date: string; growth: number; spy: number };

/** Daily growth of the entry and of SPY since the start, both starting at 1. */
export async function getEntrySeries(id: string, startDate: string): Promise<SeriesPoint[]> {
  const { rows } = await pool.query<{ date: string; growth: string; spy: string }>(
    `WITH picks AS (
       SELECT p.ticker,
              (SELECT cp.close FROM challenge_price cp
                WHERE cp.ticker = p.ticker AND cp.date >= $2::date
                ORDER BY cp.date LIMIT 1) AS start_close
         FROM challenge_pick p WHERE p.entry_id = $1
     ),
     days AS (
       SELECT date, close FROM challenge_price
        WHERE ticker = '${BENCHMARK}' AND date >= $2::date
     ),
     base AS (SELECT close FROM days ORDER BY date LIMIT 1)
     SELECT to_char(d.date, 'YYYY-MM-DD') AS date,
            AVG(CASE WHEN pk.start_close > 0 AND lc.close > 0
                     THEN lc.close / pk.start_close ELSE 1 END) AS growth,
            d.close / (SELECT close FROM base) AS spy
       FROM days d
       CROSS JOIN picks pk
       LEFT JOIN LATERAL (
         SELECT cp.close FROM challenge_price cp
          WHERE cp.ticker = pk.ticker AND cp.date <= d.date
          ORDER BY cp.date DESC LIMIT 1
       ) lc ON TRUE
      GROUP BY d.date, d.close
      ORDER BY d.date`,
    [id, startDate],
  );
  return rows.map((r) => ({ date: r.date, growth: Number(r.growth), spy: Number(r.spy) }));
}

export type PopularPick = { ticker: string; name: string | null; entries: number };

/** The stocks most entries hold. */
export async function getPopularPicks(limit = 12): Promise<PopularPick[]> {
  const { rows } = await pool.query<PopularPick>(
    `SELECT p.ticker, st.name, COUNT(*)::int AS entries
       FROM challenge_pick p
       JOIN challenge_entry e ON e.id = p.entry_id AND NOT e.hidden
       LEFT JOIN stocks st ON st.ticker = p.ticker
      GROUP BY p.ticker, st.name
      ORDER BY entries DESC, p.ticker
      LIMIT $1`,
    [limit],
  );
  return rows;
}

/** Take an entry off the public board, or put it back. */
export async function setEntryHidden(id: string, hidden: boolean): Promise<boolean> {
  const { rowCount } = await pool.query(
    `UPDATE challenge_entry SET hidden = $2 WHERE id = $1`,
    [id, hidden],
  );
  return (rowCount ?? 0) > 0;
}
