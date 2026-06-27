import { NextResponse } from "next/server";

import { getAdminAccessApiUser } from "@/lib/api-auth";
import { D1DomainError } from "@/lib/d1/errors";
import {
  beginGoogleOAuth,
  getGoogleOAuthConfiguration,
} from "@/lib/google-cloudflare-oauth";

export const dynamic = "force-dynamic";

function requestId() {
  return `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
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

  try {
    const url = new URL(request.url);
    const result = await beginGoogleOAuth({
      userId: auth.admin.id,
      organizationId: url.searchParams.get("organizationId"),
      resources: url.searchParams.get("resources"),
      returnTo: url.searchParams.get("returnTo"),
      config,
    });

    return NextResponse.redirect(result.authorizationUrl, {
      status: 302,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    if (error instanceof D1DomainError) {
      return errorResponse(requestIdValue, error.status, error.code, "No fue posible iniciar la conexión con Google.");
    }
    console.error("[google.oauth.connect]", { requestId: requestIdValue, error });
    return errorResponse(
      requestIdValue,
      500,
      "google_oauth_start_failed",
      "No fue posible iniciar la conexión con Google.",
    );
  }
}

export async function POST(request: Request) {
  return GET(request);
}
