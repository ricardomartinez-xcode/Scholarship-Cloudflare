import type { AppD1Database } from "./contracts";
import { decryptSecret, encryptSecret } from "./crypto";
import { D1DomainError } from "./errors";
import { nowIso } from "./ids";
import { stringifyJson } from "./json";

const STATE_TTL_MS = 10 * 60 * 1000;

type StateRow = {
  state_hash: string;
  organization_id: string;
  user_id: string;
  scopes_json: string;
  return_to: string;
  code_verifier_ciphertext: string;
  expires_at: string;
  consumed_at: string | null;
};

export type GoogleOAuthState = {
  state: string;
  codeVerifier: string;
  organizationId: string;
  userId: string;
  scopes: string[];
  returnTo: string;
  expiresAt: string;
};

function base64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/u, "");
}

function randomToken(byteLength = 32): string {
  const bytes = crypto.getRandomValues(new Uint8Array(byteLength));
  return base64Url(bytes);
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

export async function toPkceChallenge(codeVerifier: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(codeVerifier),
  );
  return base64Url(new Uint8Array(digest));
}

function parseScopes(raw: string): string[] {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (scope): scope is string => typeof scope === "string" && Boolean(scope.trim()),
    );
  } catch {
    return [];
  }
}

/**
 * Persists a one-time OAuth state. The browser-visible state is never stored
 * directly, and the PKCE verifier is encrypted with the token encryption key.
 */
export async function createGoogleOAuthState(
  db: AppD1Database,
  input: {
    organizationId: string;
    userId: string;
    scopes: string[];
    returnTo: string;
    encryptionKey: string;
    keyVersion?: string;
  },
): Promise<GoogleOAuthState> {
  const state = randomToken();
  const codeVerifier = randomToken(64);
  const stateHash = await sha256Hex(state);
  const createdAt = nowIso();
  const expiresAt = new Date(Date.now() + STATE_TTL_MS).toISOString();
  const codeVerifierCiphertext = await encryptSecret(
    codeVerifier,
    input.encryptionKey,
    input.keyVersion ?? "v1",
  );

  await db
    .prepare(
      `INSERT INTO google_oauth_state (
        state_hash, organization_id, user_id, scopes_json, return_to,
        code_verifier_ciphertext, expires_at, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      stateHash,
      input.organizationId,
      input.userId,
      stringifyJson(Array.from(new Set(input.scopes))),
      input.returnTo,
      codeVerifierCiphertext,
      expiresAt,
      createdAt,
    )
    .run();

  return {
    state,
    codeVerifier,
    organizationId: input.organizationId,
    userId: input.userId,
    scopes: Array.from(new Set(input.scopes)),
    returnTo: input.returnTo,
    expiresAt,
  };
}

/**
 * Marks state as consumed before returning it. A replay cannot succeed once
 * `consumed_at` is set, even when two callback requests race. The verifier is
 * cleared from D1 once copied into this request's memory.
 */
export async function consumeGoogleOAuthState(
  db: AppD1Database,
  input: { state: string; userId: string; encryptionKey: string },
): Promise<Omit<GoogleOAuthState, "state">> {
  const stateHash = await sha256Hex(input.state);
  const now = nowIso();
  const row = await db
    .prepare(
      `SELECT state_hash, organization_id, user_id, scopes_json, return_to,
        code_verifier_ciphertext, expires_at, consumed_at
       FROM google_oauth_state
       WHERE state_hash = ?
       LIMIT 1`,
    )
    .bind(stateHash)
    .first<StateRow>();

  if (!row || row.user_id !== input.userId || row.consumed_at) {
    throw new D1DomainError("Google OAuth state is invalid", "invalid_oauth_state", 400);
  }
  if (row.expires_at <= now) {
    await db
      .prepare("DELETE FROM google_oauth_state WHERE state_hash = ?")
      .bind(stateHash)
      .run();
    throw new D1DomainError("Google OAuth state expired", "expired_oauth_state", 400);
  }

  const consumed = await db
    .prepare(
      `UPDATE google_oauth_state
       SET consumed_at = ?, code_verifier_ciphertext = ''
       WHERE state_hash = ? AND consumed_at IS NULL AND expires_at > ?`,
    )
    .bind(now, stateHash, now)
    .run();

  if (Number(consumed.meta?.changes ?? 0) !== 1) {
    throw new D1DomainError("Google OAuth state was already consumed", "used_oauth_state", 400);
  }

  const verifier = await decryptSecret(
    row.code_verifier_ciphertext,
    input.encryptionKey,
  );

  return {
    codeVerifier: verifier.plaintext,
    organizationId: row.organization_id,
    userId: row.user_id,
    scopes: parseScopes(row.scopes_json),
    returnTo: row.return_to,
    expiresAt: row.expires_at,
  };
}

export async function purgeExpiredGoogleOAuthStates(
  db: AppD1Database,
): Promise<void> {
  await db
    .prepare("DELETE FROM google_oauth_state WHERE expires_at <= ?")
    .bind(nowIso())
    .run();
}
