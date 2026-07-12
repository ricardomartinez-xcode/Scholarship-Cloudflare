import { NextResponse, type NextRequest } from "next/server";

import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function safeNextPath(value: string | null) {
  const fallback = "/unidep";
  const raw = value?.trim() || fallback;

  try {
    const url = new URL(raw, "https://recalc.relead.com.mx");
    const path = `${url.pathname}${url.search}${url.hash}`;

    if (!path.startsWith("/") || path.startsWith("//")) return fallback;
    if (path.startsWith("/auth/callback")) return fallback;
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
  const code = request.nextUrl.searchParams.get("code");
  const error = request.nextUrl.searchParams.get("error_description") ??
    request.nextUrl.searchParams.get("error");
  const nextPath = safeNextPath(request.nextUrl.searchParams.get("next"));
  const newUser = request.nextUrl.searchParams.get("newUser") === "1";

  if (error) {
    return redirectTo(
      request,
      `/auth/sign-in?error=${encodeURIComponent(error)}&next=${encodeURIComponent(nextPath)}`,
    );
  }

  if (!code) {
    return redirectTo(
      request,
      `/auth/sign-in?error=${encodeURIComponent("No se pudo completar la sesion.")}&next=${encodeURIComponent(nextPath)}`,
    );
  }

  const supabase = await createSupabaseServerClient();
  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
  if (exchangeError) {
    return redirectTo(
      request,
      `/auth/sign-in?error=${encodeURIComponent("No se pudo completar la sesion.")}&next=${encodeURIComponent(nextPath)}`,
    );
  }

  return redirectTo(
    request,
    `/auth/after-login?next=${encodeURIComponent(newUser ? appendQuery(nextPath, "newUser", "1") : nextPath)}`,
  );
}
