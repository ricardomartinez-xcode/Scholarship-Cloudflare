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

function buildSignInPath(params: {
  nextPath: string;
  error?: string;
  success?: string;
  email?: string;
  forcePassword?: boolean;
}) {
  const search = new URLSearchParams({ next: params.nextPath });

  if (params.error) search.set("error", params.error);
  if (params.success) search.set("success", params.success);
  if (params.email) search.set("email", params.email);
  if (params.forcePassword) {
    search.set("method", "password");
    search.set("verified", "1");
  }

  return `/auth/sign-in?${search.toString()}`;
}

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const error = request.nextUrl.searchParams.get("error_description") ??
    request.nextUrl.searchParams.get("error");
  const nextPath = safeNextPath(request.nextUrl.searchParams.get("next"));
  const email = request.nextUrl.searchParams.get("email")?.trim().toLowerCase() || undefined;
  const newUser = request.nextUrl.searchParams.get("newUser") === "1";

  if (error) {
    return redirectTo(
      request,
      buildSignInPath({
        nextPath,
        error,
        email,
      }),
    );
  }

  if (!code) {
    return redirectTo(
      request,
      buildSignInPath({
        nextPath,
        error: "No se pudo completar la sesión.",
        email,
      }),
    );
  }

  const supabase = await createSupabaseServerClient();
  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

  if (exchangeError) {
    // Supabase verifies the email before redirecting here. When the confirmation
    // is opened from another browser or an in-app mail browser, the PKCE
    // code_verifier cookie may be unavailable, so a session cannot be exchanged.
    // The account is still confirmed and can sign in normally with its password.
    console.error("Supabase PKCE session exchange failed after email confirmation", {
      message: exchangeError.message,
      name: exchangeError.name,
      status: exchangeError.status,
    });

    return redirectTo(
      request,
      buildSignInPath({
        nextPath,
        email,
        forcePassword: true,
        success: "Correo verificado correctamente. Inicia sesión con tu contraseña para continuar.",
      }),
    );
  }

  return redirectTo(
    request,
    `/auth/after-login?next=${encodeURIComponent(
      newUser ? appendQuery(nextPath, "newUser", "1") : nextPath,
    )}`,
  );
}
