import { NextResponse } from "next/server";
import { ensureMigrations } from "@/lib/auth";
import { getArticleBySlug } from "@/lib/blog";
import { getOptedInRecipients } from "@/lib/preferences";
import { sendNewPickEmail } from "@/lib/email";

/**
 * Internal endpoint: emails every opted-in user about a new pick.
 *
 * Auth: shared secret in `Authorization: Bearer <INTERNAL_API_SECRET>`.
 *
 * Body:
 *   {
 *     "slug": "blog-article-slug",   // required — must exist in src/lib/blog.ts
 *     "ticker": "ABCD",              // required
 *     "title": "Optional override",  // optional — defaults to article.meta.title
 *     "description": "Optional"      // optional — defaults to article.meta.description
 *   }
 *
 * Example:
 *   curl -X POST https://outpick.com/api/internal/notify-pick \
 *     -H "Authorization: Bearer $INTERNAL_API_SECRET" \
 *     -H "Content-Type: application/json" \
 *     -d '{"slug":"new-pick-abcd","ticker":"ABCD"}'
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

  if (!slug) {
    return NextResponse.json({ error: "Missing 'slug'" }, { status: 400 });
  }
  if (!ticker) {
    return NextResponse.json({ error: "Missing 'ticker'" }, { status: 400 });
  }

  const article = getArticleBySlug(slug);
  if (!article) {
    return NextResponse.json(
      { error: `No article found for slug '${slug}'` },
      { status: 404 }
    );
  }

  const articleTitle =
    typeof body.title === "string" && body.title.trim()
      ? body.title.trim()
      : article.meta.title;
  const articleDescription =
    typeof body.description === "string" && body.description.trim()
      ? body.description.trim()
      : article.meta.description;

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
          recipientName: r.name,
          ticker,
          articleTitle,
          articleDescription,
          articleSlug: slug,
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
