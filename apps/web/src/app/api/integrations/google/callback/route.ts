import { NextResponse } from "next/server";

import { getAdminAccessApiUser } from "@/lib/api-auth";
import { D1DomainError } from "@/lib/d1/errors";
import {
  cancelGoogleOAuth,
  completeGoogleOAuth,
  getGoogleOAuthConfiguration,
  withGoogleOAuthStatus,
} from "@/lib/google-cloudflare-oauth";

export const dynamic = "force-dynamic";

function requestId() {
  return `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function redirect(request: Request, target: string) {
  return NextResponse.redirect(new URL(target, request.url), {
    status: 302,
    headers: { "Cache-Control": "no-store" },
  });
}

function errorResponse(
  requestIdValue: string,
  status: number,
  code: string,
  error: string,
  extra?: Record<string, unknown>,
) {
  return NextResponse.json(
    { ok: false, requestId: requestIdValue, code, error, ...(extra ?? {}) },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}

export async function GET(request: Request) {
  const requestIdValue = requestId();
  const auth = await getAdminAccessApiUser(requestIdValue);
  if (!auth.ok) return auth.response;

  const config = getGoogleOAuthConfiguration();
  if (!config.configured) {
    return errorResponse(
      requestIdValue,
      503,
      "google_oauth_not_configured",
      "La integración de Google todavía no está configurada en Cloudflare.",
      { missing: config.missing },
    );
  }

  const url = new URL(request.url);
  const state = url.searchParams.get("state")?.trim() || "";
  const code = url.searchParams.get("code")?.trim() || "";
  const providerError = url.searchParams.get("error")?.trim() || "";

  if (!state) {
    return errorResponse(
      requestIdValue,
      400,
      "invalid_oauth_state",
      "El estado de conexión de Google no es válido.",
    );
  }

  try {
    if (providerError) {
      const cancelled = await cancelGoogleOAuth({
        userId: auth.admin.id,
        state,
        config,
      });
      return redirect(request, withGoogleOAuthStatus(cancelled.returnTo, "denied"));
    }

    if (!code) {
      return errorResponse(
        requestIdValue,
        400,
        "missing_google_code",
        "Google no devolvió un código de autorización.",
      );
    }

    const completed = await completeGoogleOAuth({
      userId: auth.admin.id,
      state,
      code,
      requestId: requestIdValue,
      config,
    });

    return redirect(request, withGoogleOAuthStatus(completed.returnTo, "connected"));
  } catch (error) {
    if (error instanceof D1DomainError) {
      console.warn("[google.oauth.callback]", {
        requestId: requestIdValue,
        code: error.code,
      });
      return redirect(request, "/admin?google=error");
    }
    console.error("[google.oauth.callback]", { requestId: requestIdValue, error });
    return redirect(request, "/admin?google=error");
  }
}
