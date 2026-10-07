#!/usr/bin/env node
/**
 * One-off personal plain-text mail from email@outpick.xyz, via Resend.
 *
 * Product mail lives in src/lib/email.ts and is unchanged by this script.
 * This is a local CLI only: no route, no cron, no UI.
 *
 * Dry-run (default — prints the payload, sends nothing):
 *   node scripts/send-outreach.mjs path/to/message.json
 *   node scripts/send-outreach.mjs path/to/message.md
 *
 * Send (requires RESEND_API_KEY in the environment; never commit it):
 *   node scripts/send-outreach.mjs path/to/message.json --send
 *
 * Copy the example, fill in the real recipient locally, keep it out of git:
 *   cp scripts/outreach.example.json scripts/outreach.local.json
 *
 * Message shapes:
 *   JSON     { "to": "...", "subject": "...", "body": "..." }
 *   Markdown --- frontmatter with to / subject; the rest is the body
 *
 * From is always "Jack, Outpick" <email@outpick.xyz> with Reply-To
 * email@outpick.xyz. One recipient per invocation.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const FROM_ADDRESS = '"Jack, Outpick" <email@outpick.xyz>';
export const REPLY_TO = "email@outpick.xyz";
export const FROM_EMAIL = "email@outpick.xyz";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export const USAGE = `Usage:
  node scripts/send-outreach.mjs <file.json|file.md> [--send]

  Reads to / subject / body from one file and prints what would be sent.
  Delivers only when --send is passed. RESEND_API_KEY is required for --send.

  JSON:     { "to": "...", "subject": "...", "body": "..." }
  Markdown: ---
            to: ...
            subject: ...
            ---
            body`;

export function parseArgs(argv) {
  let file = null;
  let send = false;
  const rest = [...argv];
  while (rest.length) {
    const a = rest.shift();
    if (a === "--send") {
      send = true;
    } else if (a === "--dry-run") {
      send = false;
    } else if (a === "--help" || a === "-h") {
      return { help: true, file: null, send: false };
    } else if (a === "--file" || a === "-f") {
      file = rest.shift() ?? null;
      if (!file) throw new Error("--file needs a path");
    } else if (a.startsWith("-")) {
      throw new Error(`Unknown flag: ${a}`);
    } else if (!file) {
      file = a;
    } else {
      throw new Error(`Unexpected argument: ${a}`);
    }
  }
  return { help: false, file, send };
}

function unquote(value) {
  const v = value.trim();
  if (
    (v.startsWith('"') && v.endsWith('"') && v.length >= 2) ||
    (v.startsWith("'") && v.endsWith("'") && v.length >= 2)
  ) {
    return v.slice(1, -1);
  }
  return v;
}

function parseFrontmatter(text) {
  const trimmed = text.replace(/^\uFEFF/, "");
  if (!trimmed.startsWith("---")) {
    throw new Error(
      "Markdown messages need a --- frontmatter block with to and subject",
    );
  }
  const end = trimmed.indexOf("\n---", 3);
  if (end === -1) {
    throw new Error("Markdown frontmatter is missing the closing ---");
  }
  const raw = trimmed.slice(3, end).replace(/^\r?\n/, "");
  const body = trimmed.slice(end + 4).replace(/^\r?\n/, "");
  const fields = {};
  for (const line of raw.split(/\r?\n/)) {
    if (!line.trim() || line.trim().startsWith("#")) continue;
    const m = line.match(/^([A-Za-z][\w-]*)\s*:\s*(.*)$/);
    if (!m) throw new Error(`Bad frontmatter line: ${line}`);
    fields[m[1].toLowerCase()] = unquote(m[2]);
  }
  return { fields, body };
}

export function asMessage(fields, body) {
  if (Array.isArray(fields.to) || (typeof fields.to === "string" && fields.to.includes(","))) {
    throw new Error("One recipient at a time");
  }
  const to = String(fields.to ?? "").trim();
  const subject = String(fields.subject ?? "").trim();
  const text = String(body ?? "").replace(/^\uFEFF/, "").replace(/^\n+/, "").trimEnd();
  if (!to) throw new Error("Missing to");
  if (!EMAIL_RE.test(to)) throw new Error(`Invalid to address: ${to}`);
  if (!subject) throw new Error("Missing subject");
  if (!text) throw new Error("Missing body");
  return { to, subject, body: text };
}

export function parseMessage(source, filename) {
  const name = filename || "message";
  const ext = path.extname(name).toLowerCase();
  if (ext === ".json") {
    let data;
    try {
      data = JSON.parse(source);
    } catch (e) {
      throw new Error(`Invalid JSON in ${name}: ${e instanceof Error ? e.message : e}`);
    }
    if (!data || typeof data !== "object" || Array.isArray(data)) {
      throw new Error("JSON message must be an object with to, subject, body");
    }
    if (typeof data.body !== "string") {
      throw new Error("JSON body must be a string");
    }
    return asMessage(data, data.body);
  }
  if (ext === ".md" || ext === ".markdown") {
    const { fields, body } = parseFrontmatter(source);
    return asMessage(fields, body);
  }
  throw new Error("Message file must be .json or .md");
}

export function buildPayload(message) {
  return {
    from: FROM_ADDRESS,
    to: message.to,
    subject: message.subject,
    text: message.body,
    replyTo: REPLY_TO,
  };
}

function formatPreview(payload, { send, keySet }) {
  const lines = [
    send ? "Sending." : "Dry run (not sent). Pass --send to deliver.",
    `RESEND_API_KEY: ${keySet ? "set" : "missing"}`,
    `From: ${payload.from}`,
    `Reply-To: ${payload.replyTo}`,
    `To: ${payload.to}`,
    `Subject: ${payload.subject}`,
    "",
    payload.text,
  ];
  return lines.join("\n");
}

export async function run(opts = {}) {
  const argv = opts.argv ?? [];
  const env = opts.env ?? {};
  const readFile = opts.readFile ?? ((p) => fs.readFileSync(p, "utf8"));
  const log = opts.log ?? console.log;
  const error = opts.error ?? console.error;
  const sendEmail = opts.sendEmail;

  let parsed;
  try {
    parsed = parseArgs(argv);
  } catch (e) {
    error(e instanceof Error ? e.message : String(e));
    error(USAGE);
    return 1;
  }

  if (parsed.help || !parsed.file) {
    log(USAGE);
    return parsed.help ? 0 : 1;
  }

  const filePath = path.resolve(parsed.file);
  let source;
  try {
    source = readFile(filePath);
  } catch {
    error(`Cannot read ${filePath}`);
    return 1;
  }

  let message;
  try {
    message = parseMessage(source, filePath);
  } catch (e) {
    error(e instanceof Error ? e.message : String(e));
    return 1;
  }

  const payload = buildPayload(message);
  const key = typeof env.RESEND_API_KEY === "string" ? env.RESEND_API_KEY.trim() : "";
  log(formatPreview(payload, { send: parsed.send, keySet: Boolean(key) }));

  if (!parsed.send) return 0;

  if (!key) {
    error("RESEND_API_KEY is not set; refusing to send.");
    return 1;
  }

  try {
    const deliver =
      sendEmail ??
      (async (body) => {
        const { Resend } = await import("resend");
        const client = new Resend(key);
        return client.emails.send(body);
      });
    const result = await deliver(payload);
    if (result?.error) {
      error(result.error.message ?? "Resend send failed");
      return 1;
    }
    const id = result?.data?.id;
    log(id ? `Sent. Resend id: ${id}` : "Sent.");
    return 0;
  } catch (e) {
    error(e instanceof Error ? e.message : String(e));
    return 1;
  }
}

function invokedDirectly() {
  const entry = process.argv[1];
  if (!entry) return false;
  return path.resolve(entry) === fileURLToPath(import.meta.url);
}

if (invokedDirectly()) {
  run({
    argv: process.argv.slice(2),
    env: process.env,
  }).then((code) => {
    process.exitCode = code;
  });
}
