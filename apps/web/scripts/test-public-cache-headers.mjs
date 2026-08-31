/**
 * Runtime check that public HTML cannot be served with a year-long prerender
 * header. Run against `next start` (production headers), not `next dev`.
 *
 *   BASE_URL=http://127.0.0.1:3000 node scripts/test-public-cache-headers.mjs
 *
 * Optional: set EXPECT_LIVE_RETURN=19.24 to require that figure in
 * /track-record HTML (the live book's picks_return_pct — never hardcoded
 * in the app).
 */
import assert from "node:assert/strict";

const BASE = (process.env.BASE_URL || "http://127.0.0.1:3000").replace(/\/$/, "");
const EXPECT_LIVE_RETURN = process.env.EXPECT_LIVE_RETURN || "";

function cacheControlIsShortEnough(header) {
  if (!header) return false;
  const value = header.trim();
  if (!value) return false;
  if (/(?:^|[,;\s])(?:no-store|no-cache)(?:[,;\s]|$)/i.test(value)) return true;
  const directives = value.split(",").map((p) => p.trim().toLowerCase());
  const numberAfter = (name) => {
    for (const d of directives) {
      if (d.startsWith(`${name}=`)) {
        const n = Number(d.slice(name.length + 1));
        return Number.isFinite(n) ? n : null;
      }
    }
    return null;
  };
  const sMaxAge = numberAfter("s-maxage");
  const maxAge = numberAfter("max-age");
  const swr = numberAfter("stale-while-revalidate") ?? 0;
  const fresh = sMaxAge ?? maxAge;
  if (fresh === null) return false;
  if (fresh === 0 && directives.includes("must-revalidate")) return true;
  return fresh + swr <= 3600;
}

async function get(path) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "cache-control": "no-cache" },
    redirect: "manual",
  });
  const body = await res.text();
  return { status: res.status, headers: res.headers, body };
}

const pages = [
  { path: "/track-record", forceDynamic: true },
  { path: "/pricing", forceDynamic: false },
  { path: "/faq", forceDynamic: false },
  { path: "/blog", forceDynamic: false },
  { path: "/sitemap.xml", forceDynamic: false },
];

let failed = 0;
for (const { path } of pages) {
  const { status, headers, body } = await get(path);
  const cc = headers.get("cache-control") || "";
  const ok = status === 200 && cacheControlIsShortEnough(cc);
  const yearLong =
    /s-maxage=31536000/i.test(cc) || /stale-while-revalidate=3153\d+/i.test(cc);
  if (!ok || yearLong) {
    failed += 1;
    console.error(`FAIL ${path} status=${status} cache-control=${cc || "(missing)"}`);
  } else {
    console.log(`ok   ${path} cache-control=${cc}`);
  }

  if (path === "/pricing") {
    assert.equal(status, 200);
    assert.doesNotMatch(body, /AI research desk/i);
    assert.doesNotMatch(body, /drafted by our AI/i);
  }
  if (path === "/faq") {
    assert.equal(status, 200);
    assert.doesNotMatch(body, /AI research desk/i);
    assert.doesNotMatch(body, /drafted by our AI/i);
  }
  if (path === "/sitemap.xml") {
    assert.equal(status, 200);
    assert.doesNotMatch(body, /\/dashboard/);
    assert.doesNotMatch(body, /\/login/);
  }
  if (path === "/track-record") {
    assert.equal(status, 200);
    if (EXPECT_LIVE_RETURN) {
      assert.match(body, new RegExp(EXPECT_LIVE_RETURN.replace(".", "\\.")));
      assert.doesNotMatch(body, />Live return<[\s\S]{0,200}>(?:—|Loading the live book)/);
    }
  }
}

if (failed) {
  console.error(`\n${failed} page(s) still advertise a long-lived prerender cache.`);
  process.exit(1);
}
console.log("\npublic cache headers are short enough for the next deploy.");
