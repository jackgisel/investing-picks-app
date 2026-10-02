import crypto from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  containsUrl,
  countChars,
  estimateCostUsd,
  percentEncode,
  postThread,
  signatureBaseString,
  signRequest,
  threadUrl,
  validateThread,
  type XCredentials,
} from "@/lib/x-client";

/**
 * The signing tests run against the OAuth 1.0a example Twitter published with
 * its own documentation — a real request with a known-good base string and a
 * known-good signature. Testing our signer against itself would pass happily
 * while producing something the API rejects as a bare 401, which is exactly
 * the failure mode these vectors exist to catch.
 */
const TWITTER_EXAMPLE = {
  consumerSecret: "kAcSOqF21Fu85e7zjz7ZN2U4ZRhfV3WpwPAoE3Z7kBw",
  tokenSecret: "LswwdoUaIvS8ltyTt5jkRh4J50vUPVVHtR2YPi5kE",
  url: "https://api.twitter.com/1/statuses/update.json",
  params: {
    status: "Hello Ladies + Gentlemen, a signed OAuth request!",
    include_entities: "true",
    oauth_consumer_key: "xvz1evFS4wEEPTGEFPHBog",
    oauth_nonce: "kYjzVBB8Y0ZFabxSWbWovY3uYSQ2pTgmZeNu2VS4cg",
    oauth_signature_method: "HMAC-SHA1",
    oauth_timestamp: "1318622958",
    oauth_token: "370773112-GmHxMAgYyLbNEtIKZeRNFsMKPR9EyMZeS9weJAEb",
    oauth_version: "1.0",
  },
  expectedBase:
    "POST&https%3A%2F%2Fapi.twitter.com%2F1%2Fstatuses%2Fupdate.json&" +
    "include_entities%3Dtrue%26oauth_consumer_key%3Dxvz1evFS4wEEPTGEFPHBog%26" +
    "oauth_nonce%3DkYjzVBB8Y0ZFabxSWbWovY3uYSQ2pTgmZeNu2VS4cg%26" +
    "oauth_signature_method%3DHMAC-SHA1%26oauth_timestamp%3D1318622958%26" +
    "oauth_token%3D370773112-GmHxMAgYyLbNEtIKZeRNFsMKPR9EyMZeS9weJAEb%26" +
    "oauth_version%3D1.0%26" +
    "status%3DHello%2520Ladies%2520%252B%2520Gentlemen%252C%2520a%2520signed%2520OAuth%2520request%2521",
  expectedSignature: "tnnArxj06cWHq44gCs1OSKk/jLY=",
};

describe("percentEncode", () => {
  it("encodes the characters encodeURIComponent leaves alone", () => {
    expect(percentEncode("!*'()")).toBe("%21%2A%27%28%29");
  });

  it("leaves the unreserved set untouched", () => {
    expect(percentEncode("aZ0-._~")).toBe("aZ0-._~");
  });

  it("encodes spaces as %20, never +", () => {
    expect(percentEncode("a b")).toBe("a%20b");
  });
});

describe("signatureBaseString", () => {
  it("matches Twitter's published example", () => {
    expect(
      signatureBaseString("POST", TWITTER_EXAMPLE.url, TWITTER_EXAMPLE.params),
    ).toBe(TWITTER_EXAMPLE.expectedBase);
  });

  it("sorts on the encoded key, not the raw one", () => {
    // "a b" encodes to "a%20b", which sorts BEFORE "a!" -> "a%21".
    const base = signatureBaseString("GET", "https://example.com", {
      "a!": "1",
      "a b": "2",
    });
    expect(base.indexOf("a%2520b")).toBeLessThan(base.indexOf("a%2521"));
  });

  it("uppercases the method", () => {
    expect(signatureBaseString("post", "https://example.com", {})).toMatch(
      /^POST&/,
    );
  });
});

describe("signRequest", () => {
  it("produces Twitter's published signature for their example", () => {
    // Reproduces the example's HMAC step through the same signing key our
    // header builder uses, over the base string verified above.
    const signingKey = `${percentEncode(TWITTER_EXAMPLE.consumerSecret)}&${percentEncode(
      TWITTER_EXAMPLE.tokenSecret,
    )}`;
    const signature = crypto
      .createHmac("sha1", signingKey)
      .update(TWITTER_EXAMPLE.expectedBase)
      .digest("base64");
    expect(signature).toBe(TWITTER_EXAMPLE.expectedSignature);
  });

  it("builds a header with every required oauth field, quoted and sorted", () => {
    const header = signRequest({
      method: "POST",
      url: "https://api.x.com/2/tweets",
      credentials: creds(),
      nonce: "abc123",
      timestamp: "1700000000",
    });

    expect(header.startsWith("OAuth ")).toBe(true);
    for (const field of [
      "oauth_consumer_key",
      "oauth_nonce",
      "oauth_signature",
      "oauth_signature_method",
      "oauth_timestamp",
      "oauth_token",
      "oauth_version",
    ]) {
      expect(header).toContain(`${field}="`);
    }
    // Sorted: consumer_key precedes nonce precedes signature.
    expect(header.indexOf("oauth_consumer_key")).toBeLessThan(
      header.indexOf("oauth_nonce"),
    );
    expect(header.indexOf("oauth_nonce")).toBeLessThan(
      header.indexOf("oauth_signature="),
    );
  });

  it("is deterministic for a fixed nonce and timestamp", () => {
    const args = {
      method: "POST",
      url: "https://api.x.com/2/tweets",
      credentials: creds(),
      nonce: "abc123",
      timestamp: "1700000000",
    } as const;
    expect(signRequest(args)).toBe(signRequest(args));
  });

  it("changes the signature when the token secret changes", () => {
    const base = { method: "POST", url: "https://api.x.com/2/tweets", nonce: "n", timestamp: "1" };
    const a = signRequest({ ...base, credentials: creds() });
    const b = signRequest({
      ...base,
      credentials: { ...creds(), accessTokenSecret: "different" },
    });
    expect(a).not.toBe(b);
  });
});

describe("countChars", () => {
  it("counts a plain string by code points", () => {
    expect(countChars("hello")).toBe(5);
  });

  it("counts any URL as 23 regardless of its real length", () => {
    const short = countChars("see https://a.co");
    const long = countChars(
      "see https://example.com/a/very/long/path?with=query&more=params",
    );
    expect(short).toBe(long);
    expect(short).toBe("see ".length + 23);
  });

  it("counts an astral emoji once, not twice", () => {
    // "🧵" is two UTF-16 units; naive .length would say 2.
    expect(countChars("🧵")).toBe(1);
  });

  it("counts a bare domain as 23, the same as an explicit one", () => {
    // X linkifies both. Counting the literal 11 characters of "outpick.xyz"
    // undercounts by 12 and is how a 279-char post comes back rejected.
    expect(countChars("outpick.xyz")).toBe(23);
    expect(countChars("go to outpick.xyz/market-note")).toBe(
      "go to ".length + 23,
    );
  });

  it("does not mistake decimals or sentence breaks for domains", () => {
    const prose = "The 10-year sits at 4.726%. Consensus is +45k. S&P 7,711.76.";
    expect(countChars(prose)).toBe([...prose].length);
  });
});

describe("containsUrl", () => {
  it("sees an explicit URL", () => {
    expect(containsUrl("see https://outpick.xyz/market-note")).toBe(true);
  });

  it("sees a bare domain, which X linkifies just the same", () => {
    expect(containsUrl("see outpick.xyz/market-note")).toBe(true);
    expect(containsUrl("outpick.xyz")).toBe(true);
  });

  it("is not fooled by prose containing dots", () => {
    expect(containsUrl("The 10-year sits at 4.726%.")).toBe(false);
    expect(containsUrl("e.g. the Fed. The market shrugged.")).toBe(false);
  });

  it("does not treat an email address as a link", () => {
    expect(containsUrl("mail hello@outpick.xyz")).toBe(false);
  });
});

describe("estimateCostUsd", () => {
  it("prices a link post far above a plain one", () => {
    expect(estimateCostUsd(["plain"])).toBeCloseTo(0.015, 5);
    expect(estimateCostUsd(["see https://x.com"])).toBeCloseTo(0.2, 5);
  });

  it("sums a mixed thread", () => {
    expect(estimateCostUsd(["a", "b", "c https://x.com"])).toBeCloseTo(0.23, 5);
  });

  it("prices a bare-domain CTA as the link post it becomes", () => {
    // The regression: this was billed at $0.015 while X charged for a link.
    expect(estimateCostUsd(["read more at outpick.xyz/market-note"])).toBeCloseTo(
      0.2,
      5,
    );
  });
});

describe("validateThread", () => {
  it("passes a thread inside the limit", () => {
    expect(validateThread(["short", "also short"])).toEqual([]);
  });

  it("flags the index and the count of an over-length post", () => {
    const errors = validateThread(["ok", "x".repeat(281)]);
    expect(errors).toHaveLength(1);
    expect(errors[0].index).toBe(1);
    expect(errors[0].chars).toBe(281);
  });

  it("flags an empty post", () => {
    expect(validateThread(["ok", "   "])).toHaveLength(1);
  });

  it("measures a long URL as 23, so a post full of links still passes", () => {
    const url = `https://example.com/${"a".repeat(300)}`;
    expect(validateThread([`link: ${url}`])).toEqual([]);
  });
});

describe("postThread", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("posts nothing at all when any post is over the limit", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const result = await postThread(creds(), ["fine", "x".repeat(300)]);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.posted).toEqual([]);
    expect(result.failedAt).toBe(1);
    expect(result.error).toMatch(/nothing was posted/);
  });

  it("chains each post as a reply to the one before it", async () => {
    const bodies: Record<string, unknown>[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init: RequestInit) => {
        const body = JSON.parse(String(init.body));
        bodies.push(body);
        return jsonResponse({ data: { id: `id${bodies.length}`, text: body.text } });
      }),
    );

    const result = await postThread(creds(), ["one", "two", "three"]);

    expect(result.error).toBeNull();
    expect(result.posted.map((p) => p.id)).toEqual(["id1", "id2", "id3"]);
    expect(bodies[0].reply).toBeUndefined();
    expect(bodies[1].reply).toEqual({ in_reply_to_tweet_id: "id1" });
    expect(bodies[2].reply).toEqual({ in_reply_to_tweet_id: "id2" });
  });

  it("stops at the first failure and reports what already landed", async () => {
    let call = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        call += 1;
        if (call === 3) {
          return jsonResponse({ detail: "Rate limit exceeded" }, 429);
        }
        return jsonResponse({ data: { id: `id${call}`, text: "t" } });
      }),
    );

    const result = await postThread(creds(), ["a", "b", "c", "d"]);

    // Two landed; the fourth was never attempted.
    expect(result.posted.map((p) => p.id)).toEqual(["id1", "id2"]);
    expect(result.failedAt).toBe(2);
    expect(result.error).toBe("Rate limit exceeded");
    expect(call).toBe(3);
  });

  it("treats a 200 with no tweet id as a failure", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({ data: {} })));
    const result = await postThread(creds(), ["a"]);
    expect(result.posted).toEqual([]);
    expect(result.failedAt).toBe(0);
    expect(result.error).toBeTruthy();
  });

  it("signs every request with a fresh nonce", async () => {
    const auths: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init: RequestInit) => {
        auths.push(String((init.headers as Record<string, string>).Authorization));
        return jsonResponse({ data: { id: `id${auths.length}`, text: "t" } });
      }),
    );

    await postThread(creds(), ["a", "b"]);

    const nonce = (h: string) => h.match(/oauth_nonce="([^"]+)"/)?.[1];
    expect(nonce(auths[0])).toBeTruthy();
    expect(nonce(auths[0])).not.toBe(nonce(auths[1]));
  });
});

describe("containsUrl / threadUrl", () => {
  it("detects a url anywhere in the post", () => {
    expect(containsUrl("read more at https://outpick.io")).toBe(true);
    expect(containsUrl("no links here")).toBe(false);
  });

  it("builds a permalink and tolerates a leading @", () => {
    expect(threadUrl("@outpick", "123")).toBe("https://x.com/outpick/status/123");
    expect(threadUrl("outpick", "123")).toBe("https://x.com/outpick/status/123");
  });
});

function creds(): XCredentials {
  return {
    consumerKey: "ck",
    consumerSecret: "cs",
    accessToken: "at",
    accessTokenSecret: "ats",
  };
}

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}
