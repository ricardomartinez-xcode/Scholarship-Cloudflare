import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { updateSupabaseSession } from "@/lib/supabase/middleware";

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

function buildAdminSignInUrl(request: NextRequest) {
  return new URL("/admin/auth", request.url);
}

function hasAuthSubject(claims: unknown) {
  return (
    typeof claims === "object" &&
    claims !== null &&
    "sub" in claims &&
    typeof claims.sub === "string" &&
    claims.sub.length > 0
  );
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const { response, claims } = await updateSupabaseSession(request);
  const authenticated = hasAuthSubject(claims);

  if (pathname.startsWith("/admin")) {
    if (!isAdminPublicPath(pathname) && !authenticated) {
      return NextResponse.redirect(buildAdminSignInUrl(request));
    }
    return response;
  }

  if (
    pathname.startsWith("/api/admin") &&
    !isAdminPublicApiPath(pathname) &&
    !authenticated
  ) {
    return NextResponse.json(
      { ok: false, error: "No autorizado." },
      { status: 401 },
    );
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\.[^/]+$).*)",
  ],
};
