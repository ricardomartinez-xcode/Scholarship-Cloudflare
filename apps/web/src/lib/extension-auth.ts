import "server-only";

import {
  classifyNeonAuthSignInFailure,
  createNeonAuthSessionMissingFailure,
  createNeonAuthUnreachableFailure,
} from "@/lib/extension-auth-errors";
import { getNeonAuthBaseUrl } from "@/lib/auth/server";
import { logStructured } from "@/lib/observability";

export const EXTENSION_SESSION_TOKEN_HEADER = "x-extension-session-token";
export const NEON_AUTH_SESSION_COOKIE_NAME = "__Secure-neon-auth.session_token";

type UpstreamSessionPayload = {
  session?: unknown | null;
  user?: unknown | null;
};

type NeonAuthErrorPayload = {
  error?: unknown;
  code?: unknown;
  errorCode?: unknown;
};

function buildSessionCookieHeader(sessionToken: string) {
  return `${NEON_AUTH_SESSION_COOKIE_NAME}=${encodeURIComponent(sessionToken)}`;
}

export function normalizeExtensionSessionToken(sessionToken: string) {
  const trimmedToken = sessionToken.trim();
  if (!trimmedToken) return "";
  try {
    return decodeURIComponent(trimmedToken);
  } catch {
    return trimmedToken;
  }
}

function extractSessionTokenFromSetCookies(setCookieHeaders: string[]) {
  const prefix = `${NEON_AUTH_SESSION_COOKIE_NAME}=`;

  for (const header of setCookieHeaders) {
    const cookiePair = header.split(";", 1)[0]?.trim() ?? "";
    if (!cookiePair.startsWith(prefix)) continue;

    const serializedValue = cookiePair.slice(prefix.length);
    if (!serializedValue) continue;

    try {
      return decodeURIComponent(serializedValue);
    } catch {
      return serializedValue;
    }
  }

  return null;
}

function readSafeDiagnosticCode(value: unknown) {
  const normalized = String(value ?? "")
    .trim()
    .toLowerCase();
  if (!normalized || normalized.length > 96) return null;
  if (!/^[a-z0-9._-]+$/.test(normalized)) return null;
  return normalized;
}

function extractUpstreamErrorCode(payload: NeonAuthErrorPayload | null) {
  const nestedError =
    payload?.error && typeof payload.error === "object"
      ? (payload.error as { code?: unknown })
      : null;

  return (
    readSafeDiagnosticCode(nestedError?.code) ??
    readSafeDiagnosticCode(payload?.code) ??
    readSafeDiagnosticCode(payload?.errorCode)
  );
}

function extractUpstreamRequestId(headers: Headers) {
  for (const headerName of [
    "x-neon-request-id",
    "x-request-id",
    "x-vercel-id",
    "cf-ray",
  ]) {
    const value = headers.get(headerName)?.trim();
    if (value) return value;
  }
  return null;
}

export async function signInExtensionAuthSession({
  email,
  password,
  origin,
}: {
  email: string;
  password: string;
  origin: string;
}) {
  let response: Response;

  try {
    response = await fetch(`${getNeonAuthBaseUrl()}/sign-in/email`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Origin: origin,
        Referer: origin,
      },
      body: JSON.stringify({ email, password }),
      cache: "no-store",
    });
  } catch (error) {
    const failure = createNeonAuthUnreachableFailure();
    logStructured(
      "error",
      "Neon Auth extension sign-in request failed",
      {
        module: "auth",
        action: "extensionSignIn",
        result: failure.code,
        actorEmail: email,
        metadata: {
          provider: "neon-auth",
          errorName: error instanceof Error ? error.name : "unknown",
        },
      },
    );
    return failure;
  }

  const payload = (await response.json().catch(() => null)) as
    | NeonAuthErrorPayload
    | null;
  const upstreamRequestId = extractUpstreamRequestId(response.headers);

  if (!response.ok) {
    const failure = classifyNeonAuthSignInFailure(response.status);
    logStructured("warn", "Neon Auth extension sign-in rejected", {
      module: "auth",
      action: "extensionSignIn",
      result: failure.code,
      actorEmail: email,
      requestId: upstreamRequestId,
      metadata: {
        provider: "neon-auth",
        upstreamStatus: response.status,
        upstreamErrorCode: extractUpstreamErrorCode(payload),
      },
    });
    return failure;
  }

  const sessionToken = extractSessionTokenFromSetCookies(
    response.headers.getSetCookie?.() ?? [],
  );

  if (!sessionToken) {
    const failure = createNeonAuthSessionMissingFailure();
    logStructured(
      "error",
      "Neon Auth extension sign-in response did not include a session cookie",
      {
        module: "auth",
        action: "extensionSignIn",
        result: failure.code,
        actorEmail: email,
        requestId: upstreamRequestId,
        metadata: {
          provider: "neon-auth",
          upstreamStatus: response.status,
        },
      },
    );
    return failure;
  }

  return {
    ok: true as const,
    sessionToken,
  };
}

export async function getExtensionAuthSession(sessionToken: string) {
  const trimmedToken = normalizeExtensionSessionToken(sessionToken);
  if (!trimmedToken) return null;

  const response = await fetch(`${getNeonAuthBaseUrl()}/get-session`, {
    method: "GET",
    headers: {
      Cookie: buildSessionCookieHeader(trimmedToken),
    },
    cache: "no-store",
  });

  if (!response.ok) {
    return null;
  }

  const payload = (await response.json().catch(() => null)) as
    | UpstreamSessionPayload
    | null;
  if (!payload?.session || !payload.user) {
    return null;
  }

  return payload;
}

export async function revokeExtensionAuthSession(sessionToken: string) {
  const trimmedToken = normalizeExtensionSessionToken(sessionToken);
  if (!trimmedToken) {
    return false;
  }

  const response = await fetch(`${getNeonAuthBaseUrl()}/sign-out`, {
    method: "POST",
    headers: {
      Cookie: buildSessionCookieHeader(trimmedToken),
    },
    cache: "no-store",
  });

  return response.ok;
}
