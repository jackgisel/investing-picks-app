import type { DataStateKind } from "@/components/ui/data-state";

/**
 * Resolve the state for a page whose primary payload can be anonymized.
 *
 * `authoritativeState` must come from an endpoint that actually enforces the
 * entitlement (picks/trades), not from `/strategy`, which intentionally answers
 * 200 with identity-stripped holdings for public marketing surfaces.
 *
 * Loading and ordinary errors block the page too. Rendering anonymized rows
 * while the authoritative request is unresolved is both a misleading flash and
 * leaves those rows with no stable identity for React keys.
 */
export function resolvePageAccessState(
  authoritativeState: DataStateKind | null,
  secondaryState: DataStateKind | null = null,
): DataStateKind | null {
  if (
    authoritativeState === "loading" ||
    authoritativeState === "error" ||
    authoritativeState === "unauthenticated" ||
    authoritativeState === "subscription"
  ) {
    return authoritativeState;
  }

  if (
    secondaryState === "unauthenticated" ||
    secondaryState === "subscription"
  ) {
    return secondaryState;
  }

  // `null` and `empty` both mean the gated endpoint answered successfully, so
  // access is established even if the strategy currently has no positions.
  return null;
}
