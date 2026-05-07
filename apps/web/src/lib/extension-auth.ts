import "server-only";

import { getNeonAuthBaseUrl } from "@/lib/auth/server";

export const EXTENSION_SESSION_TOKEN_HEADER = "x-extension-session-token";
export const NEON_AUTH_SESSION_COOKIE_NAME = "__Secure-neon-auth.session_token";

type UpstreamSessionPayload = {
  session?: unknown | null;
  user?: unknown | null;
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
  for (const header of setCookieHeaders) {
    const match = header.match(
      new RegExp(`${NEON_AUTH_SESSION_COOKIE_NAME.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}=([^;]+)`),
    );
    if (match?.[1]) {
      return decodeURIComponent(match[1]);
    }
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
  const response = await fetch(`${getNeonAuthBaseUrl()}/sign-in/email`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: origin,
      Referer: origin,
    },
    body: JSON.stringify({ email, password }),
    cache: "no-store",
  });

  const payload = (await response.json().catch(() => null)) as
    | { error?: { message?: string | null } | null }
    | null;

  if (!response.ok) {
    return {
      ok: false as const,
      error:
        payload?.error?.message ??
        `Neon Auth rechazó el acceso (${response.status}).`,
    };
  }

  const sessionToken = extractSessionTokenFromSetCookies(
    response.headers.getSetCookie?.() ?? [],
  );

  if (!sessionToken) {
    return {
      ok: false as const,
      error: "No fue posible obtener la sesión segura para la extensión.",
    };
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

  const payload = (await response.json().catch(() => null)) as UpstreamSessionPayload | null;
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
