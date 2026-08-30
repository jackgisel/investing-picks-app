import crypto from "node:crypto";

/**
 * Posting to X (Twitter) API v2.
 *
 * OAuth 1.0a rather than OAuth 2.0 PKCE, deliberately. This is a single-user
 * bot posting as one account we own, so the 3-legged authorization-code dance
 * buys nothing but a refresh token to keep alive; 1.0a user tokens are issued
 * once in the developer portal and do not expire. `POST /2/tweets` accepts
 * both.
 *
 * X removed the free tier for new developers in February 2026. Posting is
 * billed per post, and a post CONTAINING A LINK costs materially more than one
 * without — see `estimateCostUsd`. That pricing is why `splitThread` keeps
 * links out of the body: one link in the last post, not one per post.
 */

/** USD per post created. */
export const COST_PER_POST_USD = 0.015;
/** USD per post created that contains a URL. Not additive with the above. */
export const COST_PER_LINK_POST_USD = 0.2;

/**
 * Every URL costs the same 23 characters once X wraps it in t.co, however
 * long it actually is. Counting the raw string instead is what makes a post
 * that measured 279 locally come back as "too long" from the API.
 */
export const TCO_URL_LENGTH = 23;

/** Standard (non-Premium) accounts. Premium raises this; we do not assume it. */
export const DEFAULT_MAX_POST_CHARS = 280;

const URL_PATTERN = /https?:\/\/[^\s]+/gi;

export type XCredentials = {
  consumerKey: string;
  consumerSecret: string;
  accessToken: string;
  accessTokenSecret: string;
};

export type PostedTweet = { id: string; text: string };

export type ThreadResult = {
  posted: PostedTweet[];
  /** Index of the post that failed, or null when the whole thread landed. */
  failedAt: number | null;
  error: string | null;
};

/**
 * Read credentials from the environment, or null when the integration is not
 * configured. Null is a valid state — a deployment without X keys skips the
 * posting job rather than failing it, the same way a missing WEB_APP_URL
 * skips the drafting sweep.
 */
export function xCredentialsFromEnv(): XCredentials | null {
  const consumerKey = process.env.X_CONSUMER_KEY;
  const consumerSecret = process.env.X_CONSUMER_SECRET;
  const accessToken = process.env.X_ACCESS_TOKEN;
  const accessTokenSecret = process.env.X_ACCESS_TOKEN_SECRET;
  if (!consumerKey || !consumerSecret || !accessToken || !accessTokenSecret) {
    return null;
  }
  return { consumerKey, consumerSecret, accessToken, accessTokenSecret };
}

/**
 * RFC 3986 percent-encoding.
 *
 * `encodeURIComponent` leaves `!*'()` alone and OAuth requires them encoded.
 * A signature computed over a differently-encoded string is simply wrong, and
 * the API reports it as a generic 401 — so this is the single most expensive
 * detail in the file to get wrong.
 */
export function percentEncode(value: string): string {
  return encodeURIComponent(value).replace(
    /[!*'()]/g,
    (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}

/**
 * The OAuth 1.0a signature base string.
 *
 * Only OAuth parameters and query-string parameters are signed. A JSON request
 * body is NOT part of the signature (that is unique to `application/
 * x-www-form-urlencoded` bodies), which is what makes signing a v2 tweet
 * payload as simple as this.
 */
export function signatureBaseString(
  method: string,
  url: string,
  params: Record<string, string>,
): string {
  const encoded = Object.keys(params)
    .map((k) => [percentEncode(k), percentEncode(params[k])] as const)
    // Sort on the ENCODED key, then the encoded value — the spec's order, and
    // not the same as sorting the raw strings once any key needs escaping.
    .sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : a[1] < b[1] ? -1 : 1))
    .map(([k, v]) => `${k}=${v}`)
    .join("&");
  return [
    method.toUpperCase(),
    percentEncode(url),
    percentEncode(encoded),
  ].join("&");
}

export function signRequest(args: {
  method: string;
  url: string;
  credentials: XCredentials;
  /** Injectable so the signature is testable; real calls leave these unset. */
  nonce?: string;
  timestamp?: string;
}): string {
  const { method, url, credentials } = args;
  const oauthParams: Record<string, string> = {
    oauth_consumer_key: credentials.consumerKey,
    oauth_nonce: args.nonce ?? crypto.randomBytes(16).toString("hex"),
    oauth_signature_method: "HMAC-SHA1",
    oauth_timestamp:
      args.timestamp ?? String(Math.floor(Date.now() / 1000)),
    oauth_token: credentials.accessToken,
    oauth_version: "1.0",
  };

  const base = signatureBaseString(method, url, oauthParams);
  const signingKey = `${percentEncode(credentials.consumerSecret)}&${percentEncode(
    credentials.accessTokenSecret,
  )}`;
  const signature = crypto
    .createHmac("sha1", signingKey)
    .update(base)
    .digest("base64");

  const header: Record<string, string> = {
    ...oauthParams,
    oauth_signature: signature,
  };
  return `OAuth ${Object.keys(header)
    .sort()
    .map((k) => `${percentEncode(k)}="${percentEncode(header[k])}"`)
    .join(", ")}`;
}

/**
 * X's weighted character count, close enough for a pre-flight check.
 *
 * Every URL counts as 23 regardless of length. The real algorithm also weights
 * CJK and emoji at 2, which we approximate with the string's code-point length
 * rather than its UTF-16 length — that alone fixes the common case where an
 * emoji silently counted double.
 */
export function countChars(text: string): number {
  const withoutUrls = text.replace(URL_PATTERN, "");
  const urlCount = text.match(URL_PATTERN)?.length ?? 0;
  return [...withoutUrls].length + urlCount * TCO_URL_LENGTH;
}

export function containsUrl(text: string): boolean {
  URL_PATTERN.lastIndex = 0;
  return URL_PATTERN.test(text);
}

/** What this thread will cost to post, at the current pay-per-use rates. */
export function estimateCostUsd(posts: string[]): number {
  const cents = posts.reduce(
    (sum, p) =>
      sum + (containsUrl(p) ? COST_PER_LINK_POST_USD : COST_PER_POST_USD),
    0,
  );
  return Math.round(cents * 1000) / 1000;
}

export type ValidationError = { index: number; chars: number; text: string };

/**
 * Reject an over-length thread BEFORE the first post goes out.
 *
 * There is no un-post. Discovering post 6 is too long after posts 1–5 are
 * public leaves a truncated thread on the timeline that has to be deleted by
 * hand, so length is checked for the whole thread up front.
 */
export function validateThread(
  posts: string[],
  maxChars: number = DEFAULT_MAX_POST_CHARS,
): ValidationError[] {
  const errors: ValidationError[] = [];
  posts.forEach((text, index) => {
    const chars = countChars(text);
    if (chars > maxChars || text.trim().length === 0) {
      errors.push({ index, chars, text });
    }
  });
  return errors;
}

async function postOne(
  credentials: XCredentials,
  text: string,
  replyToId: string | null,
): Promise<PostedTweet> {
  const url = "https://api.x.com/2/tweets";
  const body: Record<string, unknown> = { text };
  if (replyToId) body.reply = { in_reply_to_tweet_id: replyToId };

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: signRequest({ method: "POST", url, credentials }),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const payload = (await res.json().catch(() => null)) as {
    data?: { id?: string; text?: string };
    detail?: string;
    title?: string;
    errors?: { message?: string }[];
  } | null;

  if (!res.ok || !payload?.data?.id) {
    const detail =
      payload?.errors?.map((e) => e.message).filter(Boolean).join("; ") ||
      payload?.detail ||
      payload?.title ||
      `HTTP ${res.status}`;
    throw new Error(detail);
  }
  return { id: payload.data.id, text: payload.data.text ?? text };
}

/**
 * Post a thread, each entry a reply to the one before it.
 *
 * NEVER throws on a posting failure, and never retries. Both are deliberate:
 * a thread that dies at post 4 has three posts publicly on the timeline, and
 * the only safe thing to do is report exactly what landed so the caller can
 * record it. Retrying from the top would duplicate the first three.
 *
 * The caller is expected to have claimed the right to post before calling —
 * see `claimThreadForPosting`. Nothing here is idempotent.
 */
export async function postThread(
  credentials: XCredentials,
  posts: string[],
  opts: { maxChars?: number } = {},
): Promise<ThreadResult> {
  const invalid = validateThread(posts, opts.maxChars);
  if (invalid.length > 0) {
    return {
      posted: [],
      failedAt: invalid[0].index,
      error: `Post ${invalid[0].index + 1} is ${invalid[0].chars} chars (limit ${
        opts.maxChars ?? DEFAULT_MAX_POST_CHARS
      }); nothing was posted`,
    };
  }

  const posted: PostedTweet[] = [];
  let replyTo: string | null = null;

  for (let i = 0; i < posts.length; i++) {
    try {
      const tweet = await postOne(credentials, posts[i], replyTo);
      posted.push(tweet);
      replyTo = tweet.id;
    } catch (e) {
      return {
        posted,
        failedAt: i,
        error: e instanceof Error ? e.message : "Unknown error posting to X",
      };
    }
  }

  return { posted, failedAt: null, error: null };
}

/** Permalink to a posted thread's first tweet. */
export function threadUrl(handle: string, firstTweetId: string): string {
  return `https://x.com/${handle.replace(/^@/, "")}/status/${firstTweetId}`;
}
