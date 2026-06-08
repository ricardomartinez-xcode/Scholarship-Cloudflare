import { NextResponse, type NextRequest } from "next/server";

import { getSessionUser } from "@/lib/authz";

export const dynamic = "force-dynamic";

function safeNextPath(value: string | null) {
  const fallback = "/unidep";
  const raw = value?.trim() || fallback;

  try {
    const url = new URL(raw, "https://recalc.relead.com.mx");
    const path = `${url.pathname}${url.search}${url.hash}`;

    if (!path.startsWith("/") || path.startsWith("//")) return fallback;
    if (path.startsWith("/auth/after-login")) return fallback;
    if (path.startsWith("/api/")) return fallback;

    return path;
  } catch {
    return fallback;
  }
}

function appendQuery(path: string, key: string, value: string) {
  const url = new URL(path, "https://recalc.relead.com.mx");
  url.searchParams.set(key, value);
  return `${url.pathname}${url.search}${url.hash}`;
}

function redirectTo(request: NextRequest, path: string) {
  return NextResponse.redirect(new URL(path, request.url), { status: 303 });
}

export async function GET(request: NextRequest) {
  const nextPath = safeNextPath(request.nextUrl.searchParams.get("next"));
  const newUser = request.nextUrl.searchParams.get("newUser") === "1";

  const state = await getSessionUser();

  if (state.status === "unauthenticated") {
    return redirectTo(
      request,
      `/auth/sign-in?error=${encodeURIComponent("No se pudo completar la sesión. Solicita un nuevo enlace mágico.")}&next=${encodeURIComponent(nextPath)}`,
    );
  }

  if (state.status === "forbidden") {
    return redirectTo(request, `/auth/denied?email=${encodeURIComponent(state.email)}`);
  }

  if (state.status === "inactive") {
    return redirectTo(request, "/auth/denied?reason=inactive");
  }

  const finalPath = newUser ? appendQuery(nextPath, "newUser", "1") : nextPath;
  return redirectTo(request, finalPath);
}
