import type { AppD1Database } from "./contracts";
import { nowIso } from "./ids";

const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const EMAIL_IP_LOGIN_LIMIT = 5;
const IP_LOGIN_LIMIT = 25;

type RateLimitRow = {
  attempt_count: number | string;
  window_expires_at: string;
};

type RateLimitStatus = {
  allowed: boolean;
  retryAfterSeconds: number;
};

function normalizePart(value: string | null | undefined, fallback: string) {
  const normalized = value?.trim().toLowerCase();
  return normalized || fallback;
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

async function hashRateLimitKey(scope: string, value: string) {
  // Deployments should set a Worker secret for extra protection against
  // offline guessing. A hash still keeps raw identifiers out of D1 during the
  // transition when that secret is not present.
  const pepper = process.env.CLOUDFLARE_AUTH_RATE_LIMIT_PEPPER ?? "";
  return sha256Hex(`recalc:cloudflare-auth-rate-limit:${pepper}:${scope}:${value}`);
}

async function resolveLoginKeys(input: { email?: string | null; ip?: string | null }) {
  const email = normalizePart(input.email, "unknown-email");
  const ip = normalizePart(input.ip, "unknown-ip");
  const [emailIpHash, ipHash] = await Promise.all([
    hashRateLimitKey("login:email-ip", `${email}\u0000${ip}`),
    hashRateLimitKey("login:ip", ip),
  ]);
  return { emailIpHash, ipHash };
}

function retryAfterSeconds(row: RateLimitRow | null, fallbackMs: number) {
  const expiresAt = row?.window_expires_at ? Date.parse(row.window_expires_at) : Number.NaN;
  const retryAfterMs = Number.isFinite(expiresAt)
    ? Math.max(0, expiresAt - Date.now())
    : fallbackMs;
  return Math.max(1, Math.ceil(retryAfterMs / 1000));
}

async function inspectD1Window(
  db: AppD1Database,
  input: { keyHash: string; limit: number; windowMs: number },
): Promise<RateLimitStatus> {
  const row = await db
    .prepare(
      `SELECT attempt_count, window_expires_at
       FROM cloudflare_auth_rate_limit
       WHERE key_hash = ?
       LIMIT 1`,
    )
    .bind(input.keyHash)
    .first<RateLimitRow>();

  if (!row || row.window_expires_at <= nowIso()) {
    return { allowed: true, retryAfterSeconds: 0 };
  }

  const attempts = Number(row.attempt_count ?? 0);
  return {
    allowed: attempts < input.limit,
    retryAfterSeconds: retryAfterSeconds(row, input.windowMs),
  };
}

async function consumeD1Window(
  db: AppD1Database,
  input: { keyHash: string; limit: number; windowMs: number },
): Promise<RateLimitStatus> {
  const now = nowIso();
  const expiresAt = new Date(Date.now() + input.windowMs).toISOString();

  await db
    .prepare(
      `INSERT INTO cloudflare_auth_rate_limit (
        key_hash, attempt_count, window_expires_at, updated_at
      ) VALUES (?, 1, ?, ?)
      ON CONFLICT(key_hash) DO UPDATE SET
        attempt_count = CASE
          WHEN cloudflare_auth_rate_limit.window_expires_at <= excluded.updated_at THEN 1
          ELSE cloudflare_auth_rate_limit.attempt_count + 1
        END,
        window_expires_at = CASE
          WHEN cloudflare_auth_rate_limit.window_expires_at <= excluded.updated_at THEN excluded.window_expires_at
          ELSE cloudflare_auth_rate_limit.window_expires_at
        END,
        updated_at = excluded.updated_at`,
    )
    .bind(input.keyHash, expiresAt, now)
    .run();

  const row = await db
    .prepare(
      `SELECT attempt_count, window_expires_at
       FROM cloudflare_auth_rate_limit
       WHERE key_hash = ?
       LIMIT 1`,
    )
    .bind(input.keyHash)
    .first<RateLimitRow>();

  const attempts = Number(row?.attempt_count ?? input.limit + 1);
  return {
    allowed: attempts <= input.limit,
    retryAfterSeconds: retryAfterSeconds(row ?? null, input.windowMs),
  };
}

/** Checks counters before a password is verified. Successful logins do not increment them. */
export async function checkCloudflareLoginRateLimit(
  db: AppD1Database,
  input: { email?: string | null; ip?: string | null },
): Promise<RateLimitStatus> {
  const { emailIpHash, ipHash } = await resolveLoginKeys(input);
  const [byEmailIp, byIp] = await Promise.all([
    inspectD1Window(db, {
      keyHash: emailIpHash,
      limit: EMAIL_IP_LOGIN_LIMIT,
      windowMs: LOGIN_WINDOW_MS,
    }),
    inspectD1Window(db, {
      keyHash: ipHash,
      limit: IP_LOGIN_LIMIT,
      windowMs: LOGIN_WINDOW_MS,
    }),
  ]);

  return {
    allowed: byEmailIp.allowed && byIp.allowed,
    retryAfterSeconds: Math.max(byEmailIp.retryAfterSeconds, byIp.retryAfterSeconds),
  };
}

/** Records an unsuccessful password verification against both distributed counters. */
export async function consumeCloudflareLoginFailure(
  db: AppD1Database,
  input: { email?: string | null; ip?: string | null },
): Promise<RateLimitStatus> {
  const { emailIpHash, ipHash } = await resolveLoginKeys(input);
  const [byEmailIp, byIp] = await Promise.all([
    consumeD1Window(db, {
      keyHash: emailIpHash,
      limit: EMAIL_IP_LOGIN_LIMIT,
      windowMs: LOGIN_WINDOW_MS,
    }),
    consumeD1Window(db, {
      keyHash: ipHash,
      limit: IP_LOGIN_LIMIT,
      windowMs: LOGIN_WINDOW_MS,
    }),
  ]);

  return {
    allowed: byEmailIp.allowed && byIp.allowed,
    retryAfterSeconds: Math.max(byEmailIp.retryAfterSeconds, byIp.retryAfterSeconds),
  };
}

export async function purgeExpiredCloudflareLoginRateLimits(
  db: AppD1Database,
): Promise<void> {
  await db
    .prepare("DELETE FROM cloudflare_auth_rate_limit WHERE window_expires_at <= ?")
    .bind(nowIso())
    .run();
}
