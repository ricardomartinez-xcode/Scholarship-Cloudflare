import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { auth } from "@/lib/auth/server";

const OAUTH_SESSION_VERIFIER_PARAM = "neon_auth_session_verifier";
let neonAuthMiddleware: ReturnType<typeof auth.middleware> | null = null;

function getNeonAuthMiddleware() {
  if (neonAuthMiddleware) return neonAuthMiddleware;
  neonAuthMiddleware = auth.middleware({ loginUrl: "/auth/sign-in" });
  return neonAuthMiddleware;
}

const isAdminPublicPath = (pathname: string) =>
  pathname === "/admin/auth" ||
  pathname === "/admin/auth/" ||
  pathname === "/admin/login" ||
  pathname === "/admin/login/";

const isAdminPublicApiPath = (pathname: string) =>
  pathname === "/api/admin/sign-in" ||
  pathname === "/api/admin/sign-in/" ||
  pathname === "/api/admin/health" ||
  pathname === "/api/admin/health/";

function hasAuthCookie(request: NextRequest) {
  return request.cookies.getAll().some(({ name }) => {
    // Match Neon Auth / Better Auth session cookies, including the
    // __Secure-neon-auth.session_token name used by the Next.js adapter.
    return (
      name.startsWith("__Secure-neon-auth.") ||
      name.startsWith("__Host-neon-auth.") ||
      name.startsWith("neon-auth.") ||
      name.startsWith("neon_auth.") ||
      name.startsWith("better-auth.") ||
      name.startsWith("better_auth.") ||
      /(?:^|[._-])session_token$/i.test(name) ||
      /^(?:auth|session)[._-]/i.test(name)
    );
  });
}

function needsOAuthSessionExchange(request: NextRequest) {
  return request.nextUrl.searchParams.has(OAUTH_SESSION_VERIFIER_PARAM);
}

function buildAdminSignInUrl(request: NextRequest) {
  return new URL("/admin/auth", request.url);
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (needsOAuthSessionExchange(request)) {
    return getNeonAuthMiddleware()(request);
  }

  const authCookiePresent = hasAuthCookie(request);

  if (pathname.startsWith("/admin")) {
    if (!isAdminPublicPath(pathname) && !authCookiePresent) {
      return NextResponse.redirect(buildAdminSignInUrl(request));
    }
    return NextResponse.next();
  }

  if (
    pathname.startsWith("/api/admin") &&
    !isAdminPublicApiPath(pathname) &&
    !authCookiePresent
  ) {
    return NextResponse.json(
      { ok: false, error: "No autorizado." },
      { status: 401 }
    );
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\.[^/]+$).*)",
  ],
};
