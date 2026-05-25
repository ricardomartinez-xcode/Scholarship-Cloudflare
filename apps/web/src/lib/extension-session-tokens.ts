import "server-only";

import crypto from "node:crypto";

import type { User } from "@prisma/client";

import { prisma } from "@/lib/prisma";

export const EXTENSION_TOKEN_PREFIX = "rx_ext_";
const MIN_TTL_MS = 1000 * 60 * 5;
const MAX_TTL_MS = 1000 * 60 * 60 * 24;
const DEFAULT_TTL_MS = MAX_TTL_MS;
const MAX_CLIENT_LENGTH = 80;
const MAX_VERSION_LENGTH = 32;
const MAX_UA_LENGTH = 240;

type ExtensionSessionTokenRow = {
  id: string;
  userId: string;
  expiresAt: Date;
  revokedAt: Date | null;
};

function sha256(value: string) {
  return crypto.createHash("sha256").update(value, "utf8").digest("hex");
}

function trimForStorage(value: string | null | undefined, maxLength: number) {
  const trimmed = String(value ?? "").trim();
  return trimmed ? trimmed.slice(0, maxLength) : null;
}

function clampTtlMs(ttlMs: number | null | undefined) {
  const requested = Number(ttlMs ?? DEFAULT_TTL_MS);
  if (!Number.isFinite(requested)) return DEFAULT_TTL_MS;
  return Math.min(MAX_TTL_MS, Math.max(MIN_TTL_MS, requested));
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
  ttlMs?: number | null;
}) {
  const id = crypto.randomUUID();
  const secret = crypto.randomBytes(32).toString("base64url");
  const token = `${EXTENSION_TOKEN_PREFIX}${id}.${secret}`;
  const tokenHash = sha256(secret);
  const scope = trimForStorage(params.scope, 120) ?? "extension:default";
  const client = trimForStorage(params.client, MAX_CLIENT_LENGTH);
  const expiresAt = new Date(Date.now() + clampTtlMs(params.ttlMs));

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
      (${id}::uuid, ${params.userId}::uuid, ${tokenHash}, ${scope}, ${client}, ${trimForStorage(params.extensionVersion, MAX_VERSION_LENGTH)}, ${trimForStorage(params.userAgent, MAX_UA_LENGTH)}, ${expiresAt}, now())
  `;

  return { token, expiresAt };
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

export async function getIssuedExtensionSessionUser(token: string): Promise<User | null> {
  const parsed = parseIssuedExtensionToken(token);
  if (!parsed) return null;
  const tokenHash = sha256(parsed.secret);

  const rows = await prisma.$queryRaw<ExtensionSessionTokenRow[]>`
    select id, "userId", "expiresAt", "revokedAt"
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

  return prisma.user.findUnique({ where: { id: row.userId } });
}
