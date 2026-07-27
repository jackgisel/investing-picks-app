/**
 * Comment threads on blog posts and research notes.
 *
 * Posts and insights are filesystem content, not database rows, so a thread is
 * addressed by (type, slug) rather than a foreign key. `SUBJECT_TYPES` is the
 * allowlist and is enforced again by a CHECK constraint — a typo here would
 * otherwise open a second, invisible thread on the same page.
 */

export const SUBJECT_TYPES = ["blog", "insight"] as const;
export type SubjectType = (typeof SUBJECT_TYPES)[number];

export const MAX_COMMENT_LENGTH = 4000;

export function isSubjectType(v: unknown): v is SubjectType {
  return typeof v === "string" && (SUBJECT_TYPES as readonly string[]).includes(v);
}

export interface CommentAuthor {
  id: string;
  /**
   * What the thread shows. Null when the user has not set a display name —
   * deliberately NOT falling back to BetterAuth's `name`, which is the signup
   * name and usually a real one. Publishing it because someone typed a comment
   * would leak an identity they never chose to make public.
   */
  displayName: string | null;
}

export interface CommentRow {
  id: string;
  parentId: string | null;
  body: string | null;
  createdAt: string;
  editedAt: string | null;
  deleted: boolean;
  author: CommentAuthor;
  /** Whether the requesting user may delete this comment. */
  canDelete: boolean;
}

/** The name shown when someone has not picked one. */
export const ANONYMOUS_NAME = "Member";

export function resolveDisplayName(displayName: string | null): string {
  const trimmed = displayName?.trim();
  return trimmed ? trimmed : ANONYMOUS_NAME;
}

/**
 * Validate a submitted body. Returns an error message, or null when fine.
 *
 * Length is capped so one comment cannot dominate a page, and the emptiness
 * check runs on the TRIMMED value — otherwise a comment of pure whitespace
 * posts successfully and renders as a blank row nobody can explain.
 */
export function validateBody(raw: unknown): { body: string } | { error: string } {
  if (typeof raw !== "string") return { error: "Comment is required." };
  const body = raw.trim();
  if (!body) return { error: "Comment cannot be empty." };
  if (body.length > MAX_COMMENT_LENGTH) {
    return { error: `Comment must be ${MAX_COMMENT_LENGTH} characters or fewer.` };
  }
  return { body };
}
