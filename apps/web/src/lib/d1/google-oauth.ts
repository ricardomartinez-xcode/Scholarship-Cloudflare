import type { AppD1Database, JsonObject } from "./contracts";
import { newId, nowIso } from "./ids";
import { stringifyJson } from "./json";
import { encryptSecret, decryptSecret } from "./crypto";
import { D1DomainError } from "./errors";

export interface SaveGoogleConnectionInput {
  organizationId: string;
  userId: string;
  providerSubject: string;
  providerEmail?: string | null;
  scopes: string[];
  refreshToken: string;
  accessToken?: string | null;
  accessTokenExpiresAt?: string | null;
  metadata?: JsonObject;
  encryptionKey: string;
  keyVersion?: string;
}

interface OAuthConnectionRow {
  id: string;
  refresh_token_ciphertext: string;
  access_token_ciphertext: string | null;
  token_key_version: string;
  status: string;
}

export async function saveGoogleConnection(
  db: AppD1Database,
  input: SaveGoogleConnectionInput,
): Promise<string> {
  if (!input.refreshToken) {
    throw new D1DomainError("Google refresh token is required", "missing_refresh_token", 400);
  }

  const now = nowIso();
  const id = newId("oauth");
  const keyVersion = input.keyVersion ?? "v1";
  const refreshCiphertext = await encryptSecret(
    input.refreshToken,
    input.encryptionKey,
    keyVersion,
  );
  const accessCiphertext = input.accessToken
    ? await encryptSecret(input.accessToken, input.encryptionKey, keyVersion)
    : null;

  await db
    .prepare(
      `INSERT INTO oauth_connection (
        id, organization_id, user_id, provider, provider_subject, provider_email,
        scopes_json, refresh_token_ciphertext, access_token_ciphertext,
        access_token_expires_at, token_key_version, status, metadata_json,
        created_at, updated_at
      ) VALUES (?, ?, ?, 'google', ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, ?)
      ON CONFLICT(provider, organization_id, provider_subject) DO UPDATE SET
        user_id = excluded.user_id,
        provider_email = excluded.provider_email,
        scopes_json = excluded.scopes_json,
        refresh_token_ciphertext = excluded.refresh_token_ciphertext,
        access_token_ciphertext = excluded.access_token_ciphertext,
        access_token_expires_at = excluded.access_token_expires_at,
        token_key_version = excluded.token_key_version,
        status = 'active',
        last_error_code = NULL,
        last_error_message = NULL,
        metadata_json = excluded.metadata_json,
        revoked_at = NULL,
        updated_at = excluded.updated_at`,
    )
    .bind(
      id,
      input.organizationId,
      input.userId,
      input.providerSubject,
      input.providerEmail ?? null,
      stringifyJson(input.scopes),
      refreshCiphertext,
      accessCiphertext,
      input.accessTokenExpiresAt ?? null,
      keyVersion,
      stringifyJson(input.metadata),
      now,
      now,
    )
    .run();

  const connection = await db
    .prepare(
      `SELECT id FROM oauth_connection
       WHERE provider = 'google'
         AND organization_id = ?
         AND provider_subject = ?`,
    )
    .bind(input.organizationId, input.providerSubject)
    .first<{ id: string }>();

  if (!connection) {
    throw new D1DomainError("OAuth connection was not persisted", "oauth_connection_missing", 500);
  }

  return connection.id;
}

export async function readGoogleTokens(
  db: AppD1Database,
  input: { connectionId: string; encryptionKey: string },
): Promise<{ refreshToken: string; accessToken: string | null; keyVersion: string }> {
  const row = await db
    .prepare(
      `SELECT id, refresh_token_ciphertext, access_token_ciphertext, token_key_version, status
       FROM oauth_connection
       WHERE id = ? AND provider = 'google'`,
    )
    .bind(input.connectionId)
    .first<OAuthConnectionRow>();

  if (!row || row.status !== "active") {
    throw new D1DomainError("Google connection is unavailable", "oauth_connection_unavailable", 404);
  }

  const refresh = await decryptSecret(row.refresh_token_ciphertext, input.encryptionKey);
  const access = row.access_token_ciphertext
    ? await decryptSecret(row.access_token_ciphertext, input.encryptionKey)
    : null;

  return {
    refreshToken: refresh.plaintext,
    accessToken: access?.plaintext ?? null,
    keyVersion: row.token_key_version,
  };
}

/**
 * Google may omit a refresh token on a repeat authorization. In that case the
 * existing active connection for the same Google subject may safely preserve
 * the prior refresh token after the subject has been verified by userinfo.
 */
export async function readGoogleTokensForSubject(
  db: AppD1Database,
  input: {
    organizationId: string;
    providerSubject: string;
    encryptionKey: string;
  },
): Promise<
  | {
      connectionId: string;
      refreshToken: string;
      accessToken: string | null;
      keyVersion: string;
    }
  | null
> {
  const connection = await db
    .prepare(
      `SELECT id
       FROM oauth_connection
       WHERE provider = 'google'
         AND organization_id = ?
         AND provider_subject = ?
         AND status = 'active'
       ORDER BY updated_at DESC
       LIMIT 1`,
    )
    .bind(input.organizationId, input.providerSubject)
    .first<{ id: string }>();

  if (!connection) return null;
  const tokens = await readGoogleTokens(db, {
    connectionId: connection.id,
    encryptionKey: input.encryptionKey,
  });
  return { connectionId: connection.id, ...tokens };
}
