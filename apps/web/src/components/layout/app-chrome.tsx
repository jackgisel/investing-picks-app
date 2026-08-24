"use client";

import { usePathname } from "next/navigation";

/** Route prefixes that are product surfaces, not marketing pages. */
const APP_PREFIXES = ["/dashboard"];

/**
 * Full-viewport marketing pages — nav stays, footer would force scroll.
 *
 * /pricing used to be in here. It is the highest-intent page on the site and
 * carried no Terms or Privacy link of its own, so on mobile the checkout page
 * was a navigational dead end. The single-viewport look is worth less than
 * that.
 */
const NO_FOOTER = new Set(["/login"]);

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

/** Like MarketingOnly, but also skips single-viewport pages. */
export function MarketingFooter({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (isAppRoute(pathname) || NO_FOOTER.has(pathname)) return null;
  return <>{children}</>;
}
