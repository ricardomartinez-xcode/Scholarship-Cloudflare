import "server-only";

export const EXTENSION_SESSION_TOKEN_HEADER = "x-extension-session-token";

type UpstreamSessionPayload = {
  session?: unknown | null;
  user?: unknown | null;
};

export function normalizeExtensionSessionToken(sessionToken: string) {
  const trimmedToken = sessionToken.trim();
  if (!trimmedToken) return "";
  try {
    return decodeURIComponent(trimmedToken);
  } catch {
    return trimmedToken;
  }
}

export async function signInExtensionAuthSession(..._args: unknown[]) {
  return {
    ok: false as const,
    error: "El inicio de sesion legacy de extension fue reemplazado por Supabase Auth.",
    status: 410,
    code: "legacy_extension_auth_removed",
  };
}

export async function getExtensionAuthSession(..._args: unknown[]): Promise<UpstreamSessionPayload | null> {
  return null;
}

export async function revokeExtensionAuthSession(..._args: unknown[]) {
  return false;
}
