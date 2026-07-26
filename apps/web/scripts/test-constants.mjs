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
import { readFileSync } from "fs";
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
