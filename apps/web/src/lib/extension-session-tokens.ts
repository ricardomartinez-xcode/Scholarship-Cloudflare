import "server-only";

import crypto from "node:crypto";

import type { User } from "@prisma/client";

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
