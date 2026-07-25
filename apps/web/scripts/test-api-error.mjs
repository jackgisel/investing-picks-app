/**
 * Error-classification and retry-policy tests for src/lib/hooks/api-error.ts.
 *
 * Run from apps/web:  node scripts/test-api-error.mjs
 *
 * Compiles the REAL source into a temp dir and imports it, rather than
 * restating the logic here — so this cannot silently drift from what ships.
 * The web app has no JS test runner configured; see also
 * scripts/test-paddle-webhook.mjs and scripts/test-api-gate.mjs.
 */
import { execFileSync } from "child_process";
import { createRequire } from "module";
import { mkdtempSync } from "fs";
import { tmpdir } from "os";
import path from "path";
import { fileURLToPath } from "url";

const here = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(here, "..");
const outDir = mkdtempSync(path.join(tmpdir(), "outpick-api-error-"));

execFileSync(
  path.join(webRoot, "node_modules", ".bin", "tsc"),
  [
    path.join(webRoot, "src", "lib", "hooks", "api-error.ts"),
    "--outDir", outDir,
    "--module", "commonjs",
    "--target", "es2020",
    "--skipLibCheck",
  ],
  { stdio: "inherit" }
);

const {
  ApiError,
  classifyStatus,
  toApiError,
  fetchJson,
  retryTransient,
  dataQueryOptions,
} = createRequire(import.meta.url)(path.join(outDir, "api-error.js"));

let failed = 0;
function check(name, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failed++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}  got=${JSON.stringify(actual)} want=${JSON.stringify(expected)}`);
}

// --- classification ---
check("401 -> unauthenticated", classifyStatus(401), "unauthenticated");
check("402 -> subscription_required", classifyStatus(402), "subscription_required");
check("403 -> subscription_required", classifyStatus(403), "subscription_required");
check("404 -> not_found", classifyStatus(404), "not_found");
check("429 -> client", classifyStatus(429), "client");
check("500 -> server", classifyStatus(500), "server");
check("502 -> server", classifyStatus(502), "server");

// --- retry policy ---
const err = (s) => new ApiError(s, classifyStatus(s), "x");
check("retry 402 attempt0", retryTransient(0, err(402)), false);
check("retry 401 attempt0", retryTransient(0, err(401)), false);
check("retry 404 attempt0", retryTransient(0, err(404)), false);
check("retry 500 attempt0", retryTransient(0, err(500)), true);
check("retry 500 attempt1", retryTransient(1, err(500)), true);
check("retry 500 attempt2 (capped)", retryTransient(2, err(500)), false);
check("retry network attempt0", retryTransient(0, new ApiError(0, "network", "x")), true);
check("retry unknown throw is retryable", retryTransient(0, new TypeError("boom")), true);
check("retryDelay grows and caps", [0, 1, 2, 9].map(dataQueryOptions.retryDelay), [500, 1000, 2000, 4000]);

// --- toApiError coercion ---
check("toApiError passthrough kind", toApiError(err(402)).kind, "subscription_required");
check("toApiError string error", toApiError(new Error("nope")).kind, "network");
check("toApiError non-error", toApiError("weird").status, 0);

// --- fetchJson against a stubbed global fetch ---
function stub(status, body, { json = true } = {}) {
  global.fetch = async () => ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => {
      if (!json) throw new SyntaxError("not json");
      return body;
    },
  });
}

(async () => {
  stub(200, { picks: [], count: 0 });
  check("200 returns parsed body", await fetchJson("/api/data/picks"), { picks: [], count: 0 });

  // Exactly what api-gate.ts returns for a signed-in non-subscriber.
  stub(402, { error: "Subscription required", reason: "unsubscribed" });
  let caught = await fetchJson("/x").catch((e) => e);
  check("402 kind", caught.kind, "subscription_required");
  check("402 status", caught.status, 402);
  check("402 surfaces server detail", caught.message, "Subscription required");
  check("402 is terminal", caught.isTerminal, true);

  // ...and for an anonymous caller.
  stub(401, { error: "Authentication required", reason: "anonymous" });
  caught = await fetchJson("/x").catch((e) => e);
  check("401 kind", caught.kind, "unauthenticated");
  check("401 is terminal", caught.isTerminal, true);

  // 5xx with an HTML body (a proxy error page) must not blow up the parser.
  stub(502, null, { json: false });
  caught = await fetchJson("/x").catch((e) => e);
  check("502 kind", caught.kind, "server");
  check("502 falls back to default message", caught.message, "The server failed to respond");
  check("502 is retryable", caught.isTerminal, false);

  // 200 with a malformed body.
  stub(200, null, { json: false });
  caught = await fetchJson("/x").catch((e) => e);
  check("200 + bad json -> network", caught.kind, "network");

  // fetch itself rejecting (offline).
  global.fetch = async () => {
    throw new TypeError("Failed to fetch");
  };
  caught = await fetchJson("/x").catch((e) => e);
  check("fetch rejection -> network", caught.kind, "network");
  check("fetch rejection status 0", caught.status, 0);
  check("fetch rejection retryable", caught.isTerminal, false);

  console.log(failed === 0 ? "\nALL PASS" : `\n${failed} FAILURES`);
  process.exit(failed === 0 ? 0 : 1);
})();
