import { NextResponse } from "next/server";
import { ensureMigrations } from "@/lib/auth";
import { subscribe } from "@/lib/market-note";
import { sendMarketNoteWelcomeEmail } from "@/lib/email";

/**
 * Public, unauthenticated write endpoint — the only one the app has.
 *
 * That makes it the obvious target for someone spraying addresses to make us
 * send unsolicited mail from our own domain, which would burn the sending
 * reputation the whole product depends on. Hence the per-IP throttle below.
 */

const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 5;

// Process-local. Good enough for one Railway instance; if the web service is
// ever scaled horizontally this needs to move to Postgres or Redis, because
// each instance would otherwise grant the full allowance independently.
const hits = new Map<string, { count: number; resetAt: number }>();

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = hits.get(ip);

  if (!entry || now > entry.resetAt) {
    hits.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    // Opportunistic sweep so the map cannot grow without bound.
    if (hits.size > 5000) {
      for (const [key, value] of hits) {
        if (now > value.resetAt) hits.delete(key);
      }
    }
    return false;
  }

  entry.count += 1;
  return entry.count > MAX_PER_WINDOW;
}

function clientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}

export async function POST(req: Request) {
  if (rateLimited(clientIp(req))) {
    return NextResponse.json(
      { error: "Too many requests. Try again in a minute." },
      { status: 429 }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { email, source, company } = (body ?? {}) as {
    email?: unknown;
    source?: unknown;
    company?: unknown;
  };

  // Honeypot. A real browser leaves the hidden field empty; most naive bots
  // fill every input. Answer 200 so the bot believes it succeeded and does not
  // retry with a different strategy.
  if (typeof company === "string" && company.trim() !== "") {
    return NextResponse.json({ status: "subscribed" });
  }

  if (typeof email !== "string") {
    return NextResponse.json({ error: "Email is required" }, { status: 400 });
  }

  await ensureMigrations();

  const result = await subscribe(
    email,
    typeof source === "string" ? source.slice(0, 64) : null
  );

  if (!result.ok) {
    if (result.reason === "invalid_email") {
      return NextResponse.json(
        { error: "That doesn't look like a valid email address." },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: "Something went wrong. Try again shortly." },
      { status: 500 }
    );
  }

  // Only mail on a genuinely new opt-in. Re-submitting an address already on
  // the list must not become a way to send someone repeated mail.
  if (result.token && result.status !== "already") {
    const sent = await sendMarketNoteWelcomeEmail({
      to: email.trim().toLowerCase(),
      token: result.token,
    });
    if (!sent.ok) {
      // The subscription is already durable, so this is not a failure the
      // visitor should see — they are on the list either way.
      console.error("[market-note] welcome email failed:", sent.error);
    }
  }

  return NextResponse.json({ status: result.status });
}
