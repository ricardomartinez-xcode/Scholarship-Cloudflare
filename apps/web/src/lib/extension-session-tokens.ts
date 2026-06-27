import "server-only";

import crypto from "node:crypto";

import type { User } from "@prisma/client";

import { d1All, d1First, d1Run } from "@/lib/cloudflare/d1";
import { isCloudflareRuntime } from "@/lib/cloudflare/runtime";
import { prisma } from "@/lib/prisma";

export const EXTENSION_TOKEN_PREFIX = "rx_ext_";

const MIN_TTL_MS = 1000 * 60 * 5;
const DAY_MS = 1000 * 60 * 60 * 24;

export const EXTENSION_SESSION_TTL_PRESETS = {
  "24h": DAY_MS,
} as const;

export type ExtensionSessionTtlPreset = keyof typeof EXTENSION_SESSION_TTL_PRESETS;

const DEFAULT_TTL_PRESET: ExtensionSessionTtlPreset = "24h";
const DEFAULT_TTL_MS = EXTENSION_SESSION_TTL_PRESETS[DEFAULT_TTL_PRESET];
const MAX_TTL_MS = EXTENSION_SESSION_TTL_PRESETS["24h"];
const MAX_CLIENT_LENGTH = 80;
const MAX_VERSION_LENGTH = 32;
const MAX_UA_LENGTH = 240;

type ExtensionSessionTokenRow = {
  id: string;
  userId: string;
  scope: string;
  expiresAt: Date;
  revokedAt: Date | null;
};

type D1ExtensionSessionRow = {
  id: string;
  user_id: string;
  scope: string;
  client: string | null;
  extension_version: string | null;
  user_agent: string | null;
  expires_at: string;
  revoked_at: string | null;
  last_used_at: string | null;
  created_at: string;
  updated_at: string;
};

type D1ExtensionSessionWithUserRow = D1ExtensionSessionRow & {
  email: string;
  auth_user_id: string | null;
  display_name: string | null;
  role: string;
  is_active: number | boolean;
  user_created_at: string;
  user_updated_at: string;
  last_login_at: string | null;
};

let d1ExtensionSessionSchemaPromise: Promise<void> | null = null;

export type IssuedExtensionSession = {
  tokenId: string;
  scope: string;
  expiresAt: Date;
  user: User;
};

export type IssuedExtensionSessionSummary = {
  id: string;
  scope: string;
  client: string | null;
  extensionVersion: string | null;
  userAgent: string | null;
  expiresAt: Date;
  revokedAt: Date | null;
  lastUsedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type ResolvedExtensionSessionExpiry = {
  expiresAt: Date;
  ttlMs: number | null;
  ttlPreset: ExtensionSessionTtlPreset | "custom";
};

function sha256(value: string) {
  return crypto.createHash("sha256").update(value, "utf8").digest("hex");
}

function nowIso() {
  return new Date().toISOString();
}

function toDate(value: string | Date | null | undefined) {
  if (!value) return null;
  return value instanceof Date ? value : new Date(value);
}

function d1Changes(result: unknown) {
  return Number((result as { meta?: { changes?: number } } | null)?.meta?.changes ?? 0);
}

function trimForStorage(value: string | null | undefined, maxLength: number) {
  const trimmed = String(value ?? "").trim();
  return trimmed ? trimmed.slice(0, maxLength) : null;
}

export function normalizeExtensionSessionTtlPreset(
  value: string | null | undefined,
): ExtensionSessionTtlPreset | null {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (!normalized) return null;

  const aliases: Record<string, ExtensionSessionTtlPreset> = {
    "24h": "24h",
    "1d": "24h",
    day: "24h",
    daily: "24h",
    dia: "24h",
    "día": "24h",
    "7d": "24h",
    week: "24h",
    weekly: "24h",
    semana: "24h",
    "30d": "24h",
    "1m": "24h",
    month: "24h",
    monthly: "24h",
    mes: "24h",
    "365d": "24h",
    "1y": "24h",
    year: "24h",
    yearly: "24h",
    annual: "24h",
    ano: "24h",
    "año": "24h",
    never: "24h",
    forever: "24h",
    none: "24h",
    "no-expiration": "24h",
    "no_expiration": "24h",
    "sin-expirar": "24h",
    "sin_expirar": "24h",
    nunca: "24h",
  };

  return aliases[normalized] ?? null;
}

function coerceTtlMs(ttlMs: number | string | null | undefined) {
  if (ttlMs === null || ttlMs === undefined || ttlMs === "") return null;
  const requested = Number(ttlMs);
  return Number.isFinite(requested) ? requested : null;
}

function clampTtlMs(ttlMs: number | string | null | undefined) {
  const requested = coerceTtlMs(ttlMs) ?? DEFAULT_TTL_MS;
  return Math.min(MAX_TTL_MS, Math.max(MIN_TTL_MS, requested));
}

export function resolveExtensionSessionExpiry(params: {
  ttlMs?: number | string | null;
  ttlPreset?: string | null;
} = {}): ResolvedExtensionSessionExpiry {
  const preset = normalizeExtensionSessionTtlPreset(params.ttlPreset);

  if (preset) {
    const presetTtlMs = EXTENSION_SESSION_TTL_PRESETS[preset];
    const ttlMs = clampTtlMs(presetTtlMs);
    return {
      expiresAt: new Date(Date.now() + ttlMs),
      ttlMs,
      ttlPreset: preset,
    };
  }

  const ttlMs = clampTtlMs(params.ttlMs);
  return {
    expiresAt: new Date(Date.now() + ttlMs),
    ttlMs,
    ttlPreset: params.ttlMs === null || params.ttlMs === undefined ? DEFAULT_TTL_PRESET : "custom",
  };
}

function parseIssuedExtensionToken(token: string) {
  const normalized = String(token ?? "").trim();
  if (!normalized.startsWith(EXTENSION_TOKEN_PREFIX)) return null;
  const rest = normalized.slice(EXTENSION_TOKEN_PREFIX.length);
  const [id, secret] = rest.split(".");
  if (!id || !secret) return null;
  return { id, secret };
}

function mapD1User(row: D1ExtensionSessionWithUserRow) {
  const createdAt = toDate(row.user_created_at) ?? new Date();
  const updatedAt = toDate(row.user_updated_at) ?? createdAt;
  return {
    id: row.user_id,
    authUserId: row.auth_user_id ?? `cloudflare:${row.user_id}`,
    email: row.email,
    displayName: row.display_name,
    role: row.role,
    isActive: Boolean(row.is_active),
    lastLoginAt: toDate(row.last_login_at),
    createdAt,
    updatedAt,
  } as User;
}

async function ensureD1ExtensionSessionSchema() {
  d1ExtensionSessionSchemaPromise ??= (async () => {
    await d1Run(
      `CREATE TABLE IF NOT EXISTS extension_session_token (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        token_hash TEXT NOT NULL UNIQUE,
        scope TEXT NOT NULL DEFAULT 'extension:default',
        client TEXT,
        extension_version TEXT,
        user_agent TEXT,
        expires_at TEXT NOT NULL,
        revoked_at TEXT,
        last_used_at TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES cloudflare_auth_user(id) ON DELETE CASCADE
      )`,
    );
    await d1Run(
      `CREATE INDEX IF NOT EXISTS extension_session_token_user_valid_idx
       ON extension_session_token(user_id, revoked_at, expires_at)`,
    );
    await d1Run(
      `CREATE INDEX IF NOT EXISTS extension_session_token_expires_idx
       ON extension_session_token(expires_at)`,
    );
  })();

  return d1ExtensionSessionSchemaPromise;
}

async function issueD1ExtensionSessionToken(params: {
  userId: string;
  client?: string | null;
  extensionVersion?: string | null;
  userAgent?: string | null;
  scope?: string | null;
  ttlMs?: number | string | null;
  ttlPreset?: string | null;
}) {
  await ensureD1ExtensionSessionSchema();

  const id = crypto.randomUUID();
  const secret = crypto.randomBytes(32).toString("base64url");
  const token = `${EXTENSION_TOKEN_PREFIX}${id}.${secret}`;
  const tokenHash = sha256(secret);
  const scope = trimForStorage(params.scope, 120) ?? "extension:default";
  const client = trimForStorage(params.client, MAX_CLIENT_LENGTH);
  const expiry = resolveExtensionSessionExpiry({
    ttlMs: params.ttlMs,
    ttlPreset: params.ttlPreset,
  });
  const timestamp = nowIso();

  await d1Run(
    `UPDATE extension_session_token
     SET revoked_at = COALESCE(revoked_at, ?), updated_at = ?
     WHERE user_id = ?
       AND scope = ?
       AND COALESCE(client, '') = COALESCE(?, '')
       AND revoked_at IS NULL
       AND expires_at > ?`,
    [timestamp, timestamp, params.userId, scope, client, timestamp],
  );

  await d1Run(
    `INSERT INTO extension_session_token
      (id, user_id, token_hash, scope, client, extension_version, user_agent, expires_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      params.userId,
      tokenHash,
      scope,
      client,
      trimForStorage(params.extensionVersion, MAX_VERSION_LENGTH),
      trimForStorage(params.userAgent, MAX_UA_LENGTH),
      expiry.expiresAt.toISOString(),
      timestamp,
      timestamp,
    ],
  );

  return {
    token,
    expiresAt: expiry.expiresAt,
    ttlMs: expiry.ttlMs,
    ttlPreset: expiry.ttlPreset,
  };
}

async function getD1IssuedExtensionSession(
  token: string,
): Promise<IssuedExtensionSession | null> {
  await ensureD1ExtensionSessionSchema();

  const parsed = parseIssuedExtensionToken(token);
  if (!parsed) return null;
  const tokenHash = sha256(parsed.secret);
  const timestamp = nowIso();

  const row = await d1First<D1ExtensionSessionWithUserRow>(
    `SELECT
        t.id, t.user_id, t.scope, t.client, t.extension_version, t.user_agent,
        t.expires_at, t.revoked_at, t.last_used_at, t.created_at, t.updated_at,
        u.email, u.auth_user_id, u.display_name, u.role, u.is_active,
        u.created_at AS user_created_at, u.updated_at AS user_updated_at,
        u.last_login_at
     FROM extension_session_token t
     INNER JOIN cloudflare_auth_user u ON u.id = t.user_id
     WHERE t.id = ?
       AND t.token_hash = ?
       AND t.revoked_at IS NULL
       AND t.expires_at > ?
     LIMIT 1`,
    [parsed.id, tokenHash, timestamp],
  );
  if (!row) return null;

  await d1Run(
    "UPDATE extension_session_token SET last_used_at = ?, updated_at = ? WHERE id = ?",
    [timestamp, timestamp, row.id],
  );

  return {
    tokenId: row.id,
    scope: row.scope,
    expiresAt: toDate(row.expires_at) ?? new Date(),
    user: mapD1User(row),
  };
}

export function isIssuedExtensionToken(token: string) {
  return Boolean(parseIssuedExtensionToken(token));
}

export async function issueExtensionSessionToken(params: {
  userId: string;
  client?: string | null;
  extensionVersion?: string | null;
  userAgent?: string | null;
  scope?: string | null;
  ttlMs?: number | string | null;
  ttlPreset?: string | null;
}) {
  if (isCloudflareRuntime()) {
    return issueD1ExtensionSessionToken(params);
  }

  const id = crypto.randomUUID();
  const secret = crypto.randomBytes(32).toString("base64url");
  const token = `${EXTENSION_TOKEN_PREFIX}${id}.${secret}`;
  const tokenHash = sha256(secret);
  const scope = trimForStorage(params.scope, 120) ?? "extension:default";
  const client = trimForStorage(params.client, MAX_CLIENT_LENGTH);
  const expiry = resolveExtensionSessionExpiry({
    ttlMs: params.ttlMs,
    ttlPreset: params.ttlPreset,
  });

  await prisma.$executeRaw`
    update recalc_admin.extension_session_token
    set "revokedAt" = coalesce("revokedAt", now()), "updatedAt" = now()
    where "userId" = ${params.userId}::uuid
      and scope = ${scope}
      and coalesce(client, '') = coalesce(${client}, '')
      and "revokedAt" is null
      and "expiresAt" > now()
  `;

  await prisma.$executeRaw`
    insert into recalc_admin.extension_session_token
      (id, "userId", "tokenHash", scope, client, "extensionVersion", "userAgent", "expiresAt", "updatedAt")
    values
      (${id}::uuid, ${params.userId}::uuid, ${tokenHash}, ${scope}, ${client}, ${trimForStorage(
        params.extensionVersion,
        MAX_VERSION_LENGTH,
      )}, ${trimForStorage(params.userAgent, MAX_UA_LENGTH)}, ${expiry.expiresAt}, now())
  `;

  return {
    token,
    expiresAt: expiry.expiresAt,
    ttlMs: expiry.ttlMs,
    ttlPreset: expiry.ttlPreset,
  };
}

export async function revokeIssuedExtensionSessionToken(token: string) {
  const parsed = parseIssuedExtensionToken(token);
  if (!parsed) return false;
  const tokenHash = sha256(parsed.secret);
  if (isCloudflareRuntime()) {
    await ensureD1ExtensionSessionSchema();

    const timestamp = nowIso();
    const result = await d1Run(
      `UPDATE extension_session_token
       SET revoked_at = COALESCE(revoked_at, ?), updated_at = ?
       WHERE id = ? AND token_hash = ? AND revoked_at IS NULL`,
      [timestamp, timestamp, parsed.id, tokenHash],
    );
    return d1Changes(result) > 0;
  }

  const result = await prisma.$executeRaw`
    update recalc_admin.extension_session_token
    set "revokedAt" = coalesce("revokedAt", now()), "updatedAt" = now()
    where id = ${parsed.id}::uuid and "tokenHash" = ${tokenHash} and "revokedAt" is null
  `;
  return Number(result) > 0;
}

export async function revokeIssuedExtensionSessionTokenById(params: {
  tokenId: string;
  userId: string;
  scope?: string | null;
}) {
  const scope = trimForStorage(params.scope, 120);
  if (isCloudflareRuntime()) {
    await ensureD1ExtensionSessionSchema();

    const timestamp = nowIso();
    const result = await d1Run(
      `UPDATE extension_session_token
       SET revoked_at = COALESCE(revoked_at, ?), updated_at = ?
       WHERE id = ?
         AND user_id = ?
         AND (? IS NULL OR scope = ?)
         AND revoked_at IS NULL`,
      [timestamp, timestamp, params.tokenId, params.userId, scope, scope],
    );
    return d1Changes(result) > 0;
  }

  const result = await prisma.$executeRaw`
    update recalc_admin.extension_session_token
    set "revokedAt" = coalesce("revokedAt", now()), "updatedAt" = now()
    where id = ${params.tokenId}::uuid
      and "userId" = ${params.userId}::uuid
      and (${scope}::text is null or scope = ${scope})
      and "revokedAt" is null
  `;
  return Number(result) > 0;
}

export async function listIssuedExtensionSessions(params: {
  userId: string;
  scope?: string | null;
  includeRevoked?: boolean;
  take?: number;
}): Promise<IssuedExtensionSessionSummary[]> {
  const scope = trimForStorage(params.scope, 120);
  const includeRevoked = Boolean(params.includeRevoked);
  const take = Math.min(100, Math.max(1, Math.trunc(Number(params.take ?? 50))));

  if (isCloudflareRuntime()) {
    await ensureD1ExtensionSessionSchema();

    const rows = await d1All<D1ExtensionSessionRow>(
      `SELECT id, user_id, scope, client, extension_version, user_agent, expires_at,
              revoked_at, last_used_at, created_at, updated_at
       FROM extension_session_token
       WHERE user_id = ?
         AND (? IS NULL OR scope = ?)
         AND (? = 1 OR revoked_at IS NULL)
       ORDER BY created_at DESC
       LIMIT ?`,
      [params.userId, scope, scope, includeRevoked ? 1 : 0, take],
    );

    return rows.map((row) => ({
      id: row.id,
      scope: row.scope,
      client: row.client,
      extensionVersion: row.extension_version,
      userAgent: row.user_agent,
      expiresAt: toDate(row.expires_at) ?? new Date(),
      revokedAt: toDate(row.revoked_at),
      lastUsedAt: toDate(row.last_used_at),
      createdAt: toDate(row.created_at) ?? new Date(),
      updatedAt: toDate(row.updated_at) ?? new Date(),
    }));
  }

  return prisma.$queryRaw<IssuedExtensionSessionSummary[]>`
    select
      id,
      scope,
      client,
      "extensionVersion",
      "userAgent",
      "expiresAt",
      "revokedAt",
      "lastUsedAt",
      "createdAt",
      "updatedAt"
    from recalc_admin.extension_session_token
    where "userId" = ${params.userId}::uuid
      and (${scope}::text is null or scope = ${scope})
      and (${includeRevoked}::boolean or "revokedAt" is null)
    order by "createdAt" desc
    limit ${take}
  `;
}

export async function getIssuedExtensionSession(
  token: string,
): Promise<IssuedExtensionSession | null> {
  if (isCloudflareRuntime()) {
    return getD1IssuedExtensionSession(token);
  }

  const parsed = parseIssuedExtensionToken(token);
  if (!parsed) return null;
  const tokenHash = sha256(parsed.secret);

  const rows = await prisma.$queryRaw<ExtensionSessionTokenRow[]>`
    select id, "userId", scope, "expiresAt", "revokedAt"
    from recalc_admin.extension_session_token
    where id = ${parsed.id}::uuid
      and "tokenHash" = ${tokenHash}
      and "revokedAt" is null
      and "expiresAt" > now()
    limit 1
  `;
  const row = rows[0];
  if (!row) return null;

  await prisma.$executeRaw`
    update recalc_admin.extension_session_token
    set "lastUsedAt" = now(), "updatedAt" = now()
    where id = ${row.id}::uuid
  `;

  const user = await prisma.user.findUnique({ where: { id: row.userId } });
  if (!user) return null;

  return {
    tokenId: row.id,
    scope: row.scope,
    expiresAt: row.expiresAt,
    user,
  };
}

export async function getIssuedExtensionSessionUser(token: string): Promise<User | null> {
  const session = await getIssuedExtensionSession(token);
  return session?.user ?? null;
}
