/**
 * Tests for scripts/send-outreach.mjs.
 *
 * Run from apps/web:  node scripts/send-outreach.test.mjs
 *
 * Never talks to Resend. --send is exercised with an injected fake.
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  FROM_ADDRESS,
  REPLY_TO,
  asMessage,
  buildPayload,
  parseArgs,
  parseMessage,
  run,
} from "./send-outreach.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const script = path.join(here, "send-outreach.mjs");

let failed = 0;
function check(name, fn) {
  try {
    fn();
    console.log(`PASS  ${name}`);
  } catch (e) {
    failed += 1;
    console.log(`FAIL  ${name}`);
    console.log(`      ${e instanceof Error ? e.stack : e}`);
  }
}

async function checkAsync(name, fn) {
  try {
    await fn();
    console.log(`PASS  ${name}`);
  } catch (e) {
    failed += 1;
    console.log(`FAIL  ${name}`);
    console.log(`      ${e instanceof Error ? e.stack : e}`);
  }
}

check("parseArgs treats a path as the file and defaults to dry-run", () => {
  assert.deepEqual(parseArgs(["note.json"]), {
    help: false,
    file: "note.json",
    send: false,
  });
});

check("parseArgs requires an explicit --send", () => {
  assert.equal(parseArgs(["note.json", "--send"]).send, true);
  assert.equal(parseArgs(["--send", "note.json"]).send, true);
  assert.equal(parseArgs(["note.json", "--dry-run"]).send, false);
  assert.equal(parseArgs(["note.json", "--send", "--dry-run"]).send, false);
});

check("parseArgs rejects unknown flags", () => {
  assert.throws(() => parseArgs(["--to", "x@y.z"]), /Unknown flag/);
});

check("parseMessage reads JSON", () => {
  const msg = parseMessage(
    JSON.stringify({
      to: "recipient@example.com",
      subject: "Hello",
      body: "One line.\n\nTwo.",
    }),
    "note.json",
  );
  assert.deepEqual(msg, {
    to: "recipient@example.com",
    subject: "Hello",
    body: "One line.\n\nTwo.",
  });
});

check("parseMessage reads markdown frontmatter", () => {
  const msg = parseMessage(
    `---
to: recipient@example.com
subject: Hello there
---

Hi,

This is the body.
`,
    "note.md",
  );
  assert.equal(msg.to, "recipient@example.com");
  assert.equal(msg.subject, "Hello there");
  assert.equal(msg.body, "Hi,\n\nThis is the body.");
});

check("parseMessage rejects a recipient list", () => {
  assert.throws(
    () =>
      parseMessage(
        JSON.stringify({
          to: ["a@example.com", "b@example.com"],
          subject: "x",
          body: "y",
        }),
        "note.json",
      ),
    /One recipient at a time/,
  );
  assert.throws(
    () => asMessage({ to: "a@example.com, b@example.com", subject: "x" }, "y"),
    /One recipient at a time/,
  );
});

check("parseMessage rejects missing fields and non-json/md", () => {
  assert.throws(
    () => parseMessage(JSON.stringify({ to: "a@example.com", subject: "x" }), "note.json"),
    /body must be a string/,
  );
  assert.throws(
    () => parseMessage("no frontmatter\n", "note.md"),
    /frontmatter/,
  );
  assert.throws(() => parseMessage("{}", "note.txt"), /\.json or \.md/);
  assert.throws(
    () => asMessage({ to: "not-an-email", subject: "x" }, "body"),
    /Invalid to address/,
  );
});

check("buildPayload pins from and reply-to, plain text only", () => {
  const payload = buildPayload({
    to: "recipient@example.com",
    subject: "Hello",
    body: "Hi.",
  });
  assert.equal(payload.from, FROM_ADDRESS);
  assert.equal(payload.replyTo, REPLY_TO);
  assert.equal(payload.to, "recipient@example.com");
  assert.equal(payload.subject, "Hello");
  assert.equal(payload.text, "Hi.");
  assert.equal("html" in payload, false);
});

check("example files parse", () => {
  const json = parseMessage(
    readFileSync(path.join(here, "outreach.example.json"), "utf8"),
    "outreach.example.json",
  );
  const md = parseMessage(
    readFileSync(path.join(here, "outreach.example.md"), "utf8"),
    "outreach.example.md",
  );
  assert.equal(json.to, "recipient@example.com");
  assert.equal(md.to, "recipient@example.com");
  assert.ok(json.body.length > 0);
  assert.ok(md.body.length > 0);
});

const logs = [];
const errors = [];
function io() {
  logs.length = 0;
  errors.length = 0;
  return {
    log: (s) => logs.push(String(s)),
    error: (s) => errors.push(String(s)),
  };
}

await checkAsync("dry-run prints the payload and does not call send", async () => {
  const sent = [];
  const code = await run({
    argv: ["note.json"],
    env: {},
    readFile: () =>
      JSON.stringify({
        to: "recipient@example.com",
        subject: "Hello",
        body: "Hi there.",
      }),
    sendEmail: async (payload) => {
      sent.push(payload);
      return { data: { id: "should-not-fire" } };
    },
    ...io(),
  });
  assert.equal(code, 0);
  assert.equal(sent.length, 0);
  const out = logs.join("\n");
  assert.match(out, /Dry run \(not sent\)/);
  assert.match(out, /To: recipient@example.com/);
  assert.match(out, /Subject: Hello/);
  assert.match(out, /Hi there\./);
  assert.match(out, /Jack, Outpick/);
  assert.match(out, /Reply-To: email@outpick\.xyz/);
  assert.doesNotMatch(out, /Sent\./);
});

await checkAsync("--send without RESEND_API_KEY refuses and does not send", async () => {
  const sent = [];
  const { log, error } = io();
  const code = await run({
    argv: ["note.json", "--send"],
    env: { RESEND_API_KEY: "   " },
    readFile: () =>
      JSON.stringify({
        to: "recipient@example.com",
        subject: "Hello",
        body: "Hi there.",
      }),
    sendEmail: async (payload) => {
      sent.push(payload);
      return { data: { id: "should-not-fire" } };
    },
    log,
    error,
  });
  assert.equal(code, 1);
  assert.equal(sent.length, 0);
  assert.match(errors.join("\n"), /RESEND_API_KEY is not set/);
});

await checkAsync("--send with a fake client delivers the pinned payload", async () => {
  const sent = [];
  const { log, error } = io();
  const code = await run({
    argv: ["note.md", "--send"],
    env: { RESEND_API_KEY: "re_test_not_a_real_key" },
    readFile: () => `---
to: recipient@example.com
subject: Hello
---

Hi there.
`,
    sendEmail: async (payload) => {
      sent.push(payload);
      return { data: { id: "fake-id" } };
    },
    log,
    error,
  });
  assert.equal(code, 0, errors.join("\n"));
  assert.equal(sent.length, 1);
  assert.deepEqual(sent[0], {
    from: FROM_ADDRESS,
    to: "recipient@example.com",
    subject: "Hello",
    text: "Hi there.",
    replyTo: REPLY_TO,
  });
  assert.match(logs.join("\n"), /Sent\. Resend id: fake-id/);
  assert.doesNotMatch(logs.join("\n") + errors.join("\n"), /re_test_not_a_real_key/);
});

await checkAsync("CLI dry-run via spawn sends nothing and exits 0", async () => {
  const dir = mkdtempSync(path.join(tmpdir(), "outpick-outreach-"));
  const file = path.join(dir, "note.json");
  writeFileSync(
    file,
    JSON.stringify({
      to: "recipient@example.com",
      subject: "Hello",
      body: "Hi there.",
    }),
  );
  const result = spawnSync(process.execPath, [script, file], {
    encoding: "utf8",
    env: { ...process.env, RESEND_API_KEY: "" },
  });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Dry run \(not sent\)/);
  assert.doesNotMatch(result.stdout, /Sent\./);
});

await checkAsync("CLI --send without a key exits 1", async () => {
  const dir = mkdtempSync(path.join(tmpdir(), "outpick-outreach-"));
  const file = path.join(dir, "note.json");
  writeFileSync(
    file,
    JSON.stringify({
      to: "recipient@example.com",
      subject: "Hello",
      body: "Hi there.",
    }),
  );
  const result = spawnSync(process.execPath, [script, file, "--send"], {
    encoding: "utf8",
    env: { PATH: process.env.PATH, RESEND_API_KEY: "" },
  });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /RESEND_API_KEY is not set/);
});

if (failed) {
  console.log(`\n${failed} failed`);
  process.exit(1);
}
console.log("\nall passed");
