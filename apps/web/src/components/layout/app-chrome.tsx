"use client";

import { usePathname } from "next/navigation";

/** Route prefixes that are product surfaces, not marketing pages. */
const APP_PREFIXES = ["/dashboard"];

export function isAppRoute(pathname: string): boolean {
  return APP_PREFIXES.some((p) => pathname.startsWith(p));
}

/**
 * Hides marketing chrome on the product surfaces.
 *
 * Children are built by the server layout and only gated here, so wrapping a
 * server component in this does not force it to become a client component.
 */
export function MarketingOnly({ children }: { children: React.ReactNode }) {
  return isAppRoute(usePathname()) ? null : <>{children}</>;
}
