/**
 * Loads `apps/video/.env.local` and exposes typed getters over it.
 *
 * This is a plain parser rather than a `dotenv` dependency — the format this
 * project needs is `KEY=value` lines plus `#` comments, which is small enough
 * that pulling in a dependency for it would be the wrong trade. Required
 * getters throw with the exact filename to fix, because this pipeline only
 * ever runs on Jack's Mac and the failure mode should be "open .env.local
 * and add a line," not a stack trace into some SDK's client constructor.
 */

import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const videoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const envLocalPath = join(videoRoot, ".env.local");

function parseEnvFile(path: string): Record<string, string> {
  if (!existsSync(path)) return {};
  const out: Record<string, string> = {};
  const contents = readFileSync(path, "utf8");
  for (const rawLine of contents.split("\n")) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

// `.env.local` wins over anything already in `process.env` for keys this
// pipeline cares about, but real environment variables (e.g. set in a shell
// profile) are read as a fallback so the file is optional if the values are
// exported another way.
const fileEnv = parseEnvFile(envLocalPath);

function read(key: string): string | undefined {
  return fileEnv[key] ?? process.env[key];
}

function required(key: string): string {
  const value = read(key);
  if (!value) {
    throw new Error(`${key} is not set in apps/video/.env.local`);
  }
  return value;
}

export const env = {
  ELEVENLABS_API_KEY: (): string => required("ELEVENLABS_API_KEY"),
  OUTPICK_ELEVENLABS_VOICE_ID: (): string => required("OUTPICK_ELEVENLABS_VOICE_ID"),
  ANTHROPIC_API_KEY: (): string => required("ANTHROPIC_API_KEY"),
  WEB_DATABASE_URL: (): string => required("WEB_DATABASE_URL"),
  OPS_API_KEY: (): string => required("OPS_API_KEY"),

  OUTPICK_API_URL: (): string => read("OUTPICK_API_URL") ?? "http://localhost:8000",
  SITE_URL: (): string => read("SITE_URL") ?? "https://outpick.io",

  VIDEO_PICK_EMBARGO_DAYS: (): number => {
    const raw = read("VIDEO_PICK_EMBARGO_DAYS");
    if (!raw) return 14;
    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) {
      throw new Error("VIDEO_PICK_EMBARGO_DAYS in apps/video/.env.local is not a number");
    }
    return parsed;
  },
};
