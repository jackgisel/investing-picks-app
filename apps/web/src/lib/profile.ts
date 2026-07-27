/**
 * The public half of a member's identity.
 *
 * Separate from BetterAuth's `name` on purpose — see the migration comment.
 * `name` is the signup name; this is what a member consents to publish.
 */

export const MIN_DISPLAY_NAME = 2;
export const MAX_DISPLAY_NAME = 32;

/** Letters, numbers, spaces and a few joiners. No URLs, no markup. */
const DISPLAY_NAME_ALLOWED = /^[\p{L}\p{N} ._'-]+$/u;

export function validateDisplayName(
  raw: unknown,
): { displayName: string } | { error: string } {
  if (typeof raw !== "string") return { error: "Display name is required." };
  // Collapse runs of whitespace: "J     G" is a layout attack on every thread
  // it appears in, and trailing spaces make two names look identical.
  const displayName = raw.trim().replace(/\s+/g, " ");
  if (displayName.length < MIN_DISPLAY_NAME) {
    return { error: `Display name must be at least ${MIN_DISPLAY_NAME} characters.` };
  }
  if (displayName.length > MAX_DISPLAY_NAME) {
    return { error: `Display name must be ${MAX_DISPLAY_NAME} characters or fewer.` };
  }
  if (!DISPLAY_NAME_ALLOWED.test(displayName)) {
    return {
      error: "Display name can use letters, numbers, spaces, and . _ ' - only.",
    };
  }
  return { displayName };
}

/**
 * Initials for the monogram avatar.
 *
 * First letter of the first two words, so "Jack Gisel" reads JG and a
 * single-word name reads as its first letter. Uppercased with a locale-aware
 * fold so non-Latin names are not mangled into empty strings.
 */
export function initialsFor(displayName: string): string {
  const words = displayName.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  const letters = words.slice(0, 2).map((w) => [...w][0] ?? "");
  return letters.join("").toLocaleUpperCase();
}

/**
 * A stable tone index for a user, so the same person keeps the same avatar
 * colour across every thread. Hashing the id rather than the name means the
 * colour does not jump when someone renames themselves.
 */
export function avatarToneIndex(userId: string, buckets: number): number {
  let h = 0;
  for (let i = 0; i < userId.length; i++) {
    h = (h * 31 + userId.charCodeAt(i)) | 0;
  }
  return Math.abs(h) % buckets;
}
