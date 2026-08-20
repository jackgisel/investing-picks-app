/**
 * Consistency checks for the performance claims in src/lib/constants.ts.
 *
 * Run from apps/web:  node scripts/test-constants.mjs
 *
 * These constants are rendered verbatim as performance claims on the landing
 * page, the pricing table and the investor deck. Both of the things checked
 * here had already drifted once: yearsCovered said 5 for a 3.8-year window,
 * and winnersCircle said 8 for a list that contained the same position three
 * times over.
 *
 * Kept as a standalone script because the web app has no JS test runner
 * configured (same pattern as test-api-gate.mjs). Reads the source text rather
 * than importing it — constants.ts is TypeScript and reaches for process.env.
 */
import assert from "assert";
import { readFileSync, readdirSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const here = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(here, "..", "src", "lib", "constants.ts"), "utf8");

function scalar(name) {
  // Quoted strings may contain commas ("Jun 15, 2022"), so match the quotes
  // explicitly rather than reading up to the next comma.
  const m = src.match(new RegExp(`^\\s*${name}:\\s*(?:"([^"]*)"|([^,\\n]+)),`, "m"));
  assert.ok(m, `could not find ${name} in constants.ts`);
  return (m[1] ?? m[2]).trim();
}

// --- the backtest window is what we say it is ------------------------------

const startDate = scalar("startDate");
const endDate = scalar("endDate");
const yearsCovered = Number(scalar("yearsCovered"));
const yearsLabel = scalar("yearsLabel");

const spanYears =
  (Date.parse(endDate) - Date.parse(startDate)) / (365.2425 * 864e5);

assert.ok(
  Math.abs(spanYears - yearsCovered) < 0.05,
  `BACKTEST.yearsCovered is ${yearsCovered} but ${startDate} - ${endDate} ` +
    `spans ${spanYears.toFixed(2)} years. These are rendered as a claim.`,
);

assert.ok(
  yearsLabel.startsWith(String(yearsCovered)),
  `BACKTEST.yearsLabel ("${yearsLabel}") disagrees with yearsCovered ` +
    `(${yearsCovered}).`,
);

// --- the winners circle counts positions, not exit tranches ----------------

const listBody = src.match(
  /export const WINNERS_CIRCLE = \[([\s\S]*?)\n\];/,
)?.[1];
assert.ok(listBody, "could not find WINNERS_CIRCLE in constants.ts");

const rows = [...listBody.matchAll(/\{\s*ticker:\s*"([A-Z.]+)"[^}]*?entry:\s*"([\d-]+)"[^}]*?exits:\s*(\d+)/g)]
  .map(([, ticker, entry, exits]) => ({ ticker, entry, exits: Number(exits) }));

assert.ok(rows.length > 0, "WINNERS_CIRCLE rows did not parse");

const winnersCircle = Number(scalar("winnersCircle"));
assert.strictEqual(
  winnersCircle,
  rows.length,
  `BACKTEST.winnersCircle is ${winnersCircle} but WINNERS_CIRCLE has ` +
    `${rows.length} entries.`,
);

const seen = new Set();
for (const { ticker, entry } of rows) {
  const key = `${ticker}@${entry}`;
  assert.ok(
    !seen.has(key),
    `WINNERS_CIRCLE lists ${ticker} entered ${entry} more than once. ` +
      `Separate exit tranches from one entry are one position, not two ` +
      `picks — fold them into a single row and bump its \`exits\`.`,
  );
  seen.add(key);
}

console.log(
  `constants: ok — ${yearsCovered}y window, ${rows.length} doubling ` +
    `positions across ${rows.reduce((n, r) => n + r.exits, 0)} exits`,
);

// --- the blog can't quietly disagree with constants.ts ----------------------
//
// The "eight vs five" doublers error happened because constants.ts was
// corrected once, carefully, with a comment explaining why — and six
// published blog posts never got the memo, because nothing checked prose
// against the source of truth. These are the specific error shapes that
// actually shipped; each one is a regression test for a real published
// mistake, not a general style linter.

const blogDir = join(here, "..", "src", "content", "blog");
const blogFiles = readdirSync(blogDir).filter((f) => f.endsWith(".tsx"));
assert.ok(blogFiles.length > 0, "no blog posts found under src/content/blog");

const BANNED_PATTERNS = [
  {
    // "eight stocks doubled", "eight positions doubled", "eight of our
    // closed positions doubled", "the eight stocks that doubled", etc. The
    // real count of *positions* that doubled is WINNERS_CIRCLE.length (5);
    // 8 was the tranche-exit count, wrongly presented as the headline.
    // "eight (partial) exits" is the correct use of the number 8 and is
    // explicitly allowed.
    re: /\beight\b(?!\s+(partial\s+)?exits?\b)[\s\S]{0,40}\bdoubl/i,
    why: 'asserts "eight" doubled — the real count is WINNERS_CIRCLE.length (5); 8 counts exit tranches, not positions',
  },
  {
    re: /\bdoubl[\s\S]{0,40}\beight\b(?!\s+(partial\s+)?exits?\b)/i,
    why: 'asserts "eight" doubled — the real count is WINNERS_CIRCLE.length (5); 8 counts exit tranches, not positions',
  },
  {
    // "66% win rate across 132 trades" / "8 of 132 trades doubled" — 132 is
    // BACKTEST.trades (individual executions), not the win-rate or
    // doubler denominator. That's BACKTEST.closedPicks (53). Stating the
    // rate "across 53 closed picks (132 ... trades)" is the correct form
    // and is explicitly allowed.
    re: /win rate(?![\s\S]{0,35}closed picks)[\s\S]{0,30}132/i,
    why: 'states the win rate "across 132" without naming the real denominator — win rate is out of BACKTEST.closedPicks (53); 132 (BACKTEST.trades) counts individual executions',
  },
  {
    re: /\b\d+ of 132\b/,
    why: '"N of 132" states a rate against BACKTEST.trades (132) — trades is not the doubler or win-rate denominator; use closedPicks (53)',
  },
  {
    // These exact stat-grid labels shipped as literal strings and are all
    // retired: CAGR is never published as a headline figure, and raw
    // cumulative spread over the S&P is not risk-adjusted alpha.
    re: /"(BACKTEST CAGR|OUTPICK CAGR|MODEL TARGET CAGR|ALPHA)"/,
    why: "uses a retired stat label — CAGR is not published as a headline figure, and cumulative excess return over the S&P is not \"alpha\"",
  },
];

let blogFailures = 0;
for (const file of blogFiles) {
  const text = readFileSync(join(blogDir, file), "utf8");
  for (const { re, why } of BANNED_PATTERNS) {
    const match = text.match(re);
    if (match) {
      blogFailures++;
      console.error(`content: FAIL — src/content/blog/${file}: ${why}`);
      console.error(`  matched: ${JSON.stringify(match[0])}`);
    }
  }
}
assert.strictEqual(
  blogFailures,
  0,
  `${blogFailures} blog post(s) contain a performance claim that has already ` +
    `drifted from constants.ts once — see the failures logged above.`,
);

console.log(`content: ok — ${blogFiles.length} blog posts checked against constants.ts`);
