import { NextResponse, type NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

// Optimistic check only: redirects visitors without a session cookie away from
// app pages. Real authorization happens in requireUser() next to the data.
export function proxy(request: NextRequest) {
  if (!getSessionCookie(request)) {
    const url = new URL("/sign-in", request.url);
    url.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/trades/:path*",
    "/accounts/:path*",
    "/import/:path*",
    "/calendar/:path*",
    "/tools/:path*",
    "/settings/:path*",
  ],
};
