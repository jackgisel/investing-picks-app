/**
 * Feature requests — what members ask us to build.
 *
 * Client-safe on purpose: the form imports the limits and the status labels
 * from here, so no `pg` import may ever appear in this file. The queries live
 * in `feature-requests-db.ts` for the reason spelled out at the top of
 * `comments-db.ts` — a driver import in a module a component reaches drags
 * `dns`/`net` into the browser bundle and fails the build.
 */

export const STATUSES = ["open", "planned", "shipped", "declined"] as const;
export type FeatureRequestStatus = (typeof STATUSES)[number];

/**
 * Long enough for a real one-line ask ("Export closed positions to CSV"),
 * short enough that the ops list stays scannable at one row per request.
 */
export const MAX_TITLE_LENGTH = 120;
export const MAX_BODY_LENGTH = 2000;

/**
 * Submissions allowed per user per rolling 24 hours.
 *
 * Every accepted request emails the owner, so an unbounded POST is an unbounded
 * send. Five is well above what anyone with something to say will hit and well
 * below what makes the inbox useless.
 */
export const DAILY_LIMIT = 5;

export function isStatus(v: unknown): v is FeatureRequestStatus {
  return typeof v === "string" && (STATUSES as readonly string[]).includes(v);
}

export const STATUS_LABEL: Record<FeatureRequestStatus, string> = {
  open: "Open",
  planned: "Planned",
  shipped: "Shipped",
  declined: "Declined",
};

/**
 * Chip styling, reusing the three `.badge-*` variants already in globals.css
 * rather than minting a fourth palette for one page. `open` and `declined`
 * share the neutral treatment: neither is a result, and colouring "declined"
 * red would read as an error rather than as an answer.
 */
export const STATUS_BADGE_CLASS: Record<FeatureRequestStatus, string> = {
  open: "bg-bg-tertiary text-text-muted",
  planned: "badge-hold",
  shipped: "badge-buy",
  declined: "bg-bg-tertiary text-text-dim",
};

export interface FeatureRequest {
  id: string;
  title: string;
  body: string;
  status: FeatureRequestStatus;
  /** The reply from triage. Shown to the member who submitted it. */
  adminNote: string | null;
  createdAt: string;
  updatedAt: string;
}

/** A request as the ops list sees it — with who sent it. */
export interface FeatureRequestWithAuthor extends FeatureRequest {
  author: {
    id: string;
    /** The public display name, null when they never set one. */
    displayName: string | null;
    email: string;
  };
}

/**
 * Validate a submission.
 *
 * Both checks run on the TRIMMED value, for the reason `validateBody` in
 * comments.ts spells out: a title of pure whitespace otherwise saves fine and
 * renders as a blank row nobody can explain. The body is optional — a good
 * one-line request should not be blocked on writing a paragraph about it.
 */
export function validateFeatureRequest(
  rawTitle: unknown,
  rawBody: unknown,
): { title: string; body: string } | { error: string } {
  if (typeof rawTitle !== "string") return { error: "A title is required." };
  const title = rawTitle.trim();
  if (!title) return { error: "A title is required." };
  if (title.length > MAX_TITLE_LENGTH) {
    return { error: `Title must be ${MAX_TITLE_LENGTH} characters or fewer.` };
  }

  // Absent and empty are the same thing here; only a wrong TYPE is a mistake
  // worth reporting, since that means the client sent something unexpected.
  if (rawBody !== undefined && rawBody !== null && typeof rawBody !== "string") {
    return { error: "Details must be text." };
  }
  const body = typeof rawBody === "string" ? rawBody.trim() : "";
  if (body.length > MAX_BODY_LENGTH) {
    return { error: `Details must be ${MAX_BODY_LENGTH} characters or fewer.` };
  }

  return { title, body };
}
