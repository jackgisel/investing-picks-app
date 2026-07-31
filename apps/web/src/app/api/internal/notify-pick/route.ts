import { NextResponse } from "next/server";
import { ensureMigrations } from "@/lib/auth";
import { getInsightBySlug, getInsightByTicker } from "@/lib/insights-db";
import { getOptedInRecipients } from "@/lib/preferences";
import { sendNewPickEmail } from "@/lib/email";

/**
 * Internal endpoint: emails every opted-in user about a new pick.
 *
 * Auth: shared secret in `Authorization: Bearer <INTERNAL_API_SECRET>`.
 *
 * The research note is resolved from the TICKER, against the `insight` table,
 * and only an APPROVED note counts. That is the guard this route exists for:
 * it makes it impossible to mail a "new pick" announcement whose research is
 * still a draft, or does not exist at all.
 *
 * Note this is the manual path. The normal way a pick gets announced is the
 * approve button in /dashboard/ops/insights, which claims the send atomically
 * before dispatching. This route does NOT set `email_sent_at`, so it can send
 * the same announcement twice — reach for it only to re-issue deliberately.
 *
 * Body:
 *   {
 *     "ticker": "ABCD",              // required — must have a pick insight
 *     "slug": "insight-slug",        // optional — override, e.g. a re-issue
 *     "title": "Optional override",  // optional — defaults to insight.title
 *     "description": "Optional"      // optional — defaults to insight.description
 *   }
 *
 * Example:
 *   curl -X POST https://outpick.xyz/api/internal/notify-pick \
 *     -H "Authorization: Bearer $INTERNAL_API_SECRET" \
 *     -H "Content-Type: application/json" \
 *     -d '{"ticker":"WDC"}'
 */
export async function POST(req: Request) {
  const secret = process.env.INTERNAL_API_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "INTERNAL_API_SECRET is not configured on the server" },
      { status: 500 }
    );
  }

  const authHeader = req.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  // Length check first, then constant-time compare
  if (
    authHeader.length !== expected.length ||
    !crypto_timingSafeEqual(authHeader, expected)
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: {
    slug?: unknown;
    ticker?: unknown;
    title?: unknown;
    description?: unknown;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const slug = typeof body.slug === "string" ? body.slug.trim() : "";
  const ticker = typeof body.ticker === "string" ? body.ticker.trim().toUpperCase() : "";

  if (!ticker) {
    return NextResponse.json({ error: "Missing 'ticker'" }, { status: 400 });
  }

  // Published notes only, on both branches. An announcement whose link lands
  // on a draft — or on a note the admin has not approved — is the one failure
  // this route exists to prevent.
  const insight = slug
    ? await getInsightBySlug(slug)
    : await getInsightByTicker(ticker);
  if (!insight) {
    return NextResponse.json(
      {
        error: slug
          ? `No insight found for slug '${slug}'`
          : `No published insight for ${ticker}. Write and deploy the research note before announcing the pick.`,
      },
      { status: 404 }
    );
  }

  const articleTitle =
    typeof body.title === "string" && body.title.trim()
      ? body.title.trim()
      : insight.title;
  const articleDescription =
    typeof body.description === "string" && body.description.trim()
      ? body.description.trim()
      : insight.description;

  // An approved note always has both, so this only fires on a row that was
  // published in some way that skipped the editor. Refuse rather than mail the
  // list a message with an empty subject line.
  if (!articleTitle || !articleDescription) {
    return NextResponse.json(
      {
        error: `Insight '${insight.slug}' is published but has no title or description.`,
      },
      { status: 409 }
    );
  }

  await ensureMigrations();
  const recipients = await getOptedInRecipients("newPicks");

  if (recipients.length === 0) {
    return NextResponse.json({
      ok: true,
      sent: 0,
      failed: 0,
      message: "No opted-in recipients",
    });
  }

  // Send sequentially with a small concurrency cap. Resend's free tier is
  // ~2 req/sec; chunks of 5 with awaits is conservative and friendly.
  const CHUNK = 5;
  let sent = 0;
  let failed = 0;
  const errors: { email: string; error: string }[] = [];

  for (let i = 0; i < recipients.length; i += CHUNK) {
    const chunk = recipients.slice(i, i + CHUNK);
    const results = await Promise.all(
      chunk.map((r) =>
        sendNewPickEmail({
          to: r.email,
          userId: r.id,
          recipientName: r.name,
          ticker,
          articleTitle,
          articleDescription,
          insightSlug: insight.slug,
        }).then((res) => ({ email: r.email, ...res }))
      )
    );
    for (const r of results) {
      if (r.ok) {
        sent += 1;
      } else {
        failed += 1;
        errors.push({ email: r.email, error: r.error ?? "unknown" });
      }
    }
  }

  return NextResponse.json({
    ok: failed === 0,
    sent,
    failed,
    total: recipients.length,
    ...(errors.length > 0 && { errors: errors.slice(0, 10) }),
  });
}

// Tiny constant-time string comparator so the auth header check doesn't leak
// length-mismatch timing. (Lengths are pre-checked above.)
function crypto_timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}
