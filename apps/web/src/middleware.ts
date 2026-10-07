import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

function hasSessionCookie(request: NextRequest) {
  return Boolean(
    request.cookies.get("better-auth.session_token") ||
      request.cookies.get("__Secure-better-auth.session_token")
  );
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // First line of defence only. The real admin check lives in the route
  // handlers (lib/admin.ts) — middleware can't read the DB and can't tell an
  // admin from any signed-in user.
  if (pathname.startsWith("/api/ops")) {
    if (!hasSessionCookie(request)) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.next();
  }

  // One URL per company page: /companies/aapl, never /companies/AAPL. Done
  // here rather than in the page because the page is cached, and a cached
  // redirect would be served for the lowercase URL too.
  if (pathname.startsWith("/companies/") && pathname !== pathname.toLowerCase()) {
    const url = request.nextUrl.clone();
    url.pathname = pathname.toLowerCase();
    return NextResponse.redirect(url, 308);
  }

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-pathname", pathname);

  // Protect dashboard routes. Keep the destination so a magic link can
  // return the reader to the note or page they opened, not to checkout.
  if (pathname.startsWith("/dashboard")) {
    if (!hasSessionCookie(request)) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      url.search = "";
      url.searchParams.set("next", pathname);
      return NextResponse.redirect(url);
    }
  }

  return NextResponse.next({ request: { headers: requestHeaders } });
}

export const config = {
  matcher: ["/dashboard", "/dashboard/:path*", "/api/ops/:path*", "/companies/:path*"],
};
