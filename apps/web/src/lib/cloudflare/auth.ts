import { cookies, headers } from "next/headers";
import type { NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";

import { isAllowedEmail } from "@/lib/domain";
import { normalizeEmail } from "@/lib/normalize";
import type { SessionUserState } from "@/lib/authz";
import { d1First, d1Run } from "@/lib/cloudflare/d1";

export const CLOUDFLARE_SESSION_COOKIE = "recalc_cf_session";

const PASSWORD_HASH_PREFIX = "pbkdf2-sha256";
const PASSWORD_HASH_ITERATIONS = 100_000;
const MIN_SUPPORTED_PASSWORD_HASH_ITERATIONS = 50_000;
const MAX_SUPPORTED_PASSWORD_HASH_ITERATIONS = 1_000_000;
const MIN_PASSWORD_LENGTH = 12;
const MAX_PASSWORD_LENGTH = 128;
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30;
const DEFAULT_OWNER_EMAIL = "ricardomartinez@relead.com.mx";

type CloudflareAuthUserRow = {
  id: string;
  auth_user_id: string | null;
  email: string;
  password_hash: string | null;
  display_name: string | null;
  role: string;
  is_active: number | boolean;
  last_login_at: string | null;
  created_at: string;
  updated_at: string;
};

type PasswordVerification = {
  valid: boolean;
  needsRehash: boolean;
};

function nowIso() {
  return new Date().toISOString();
}

function toDate(value: string | null | undefined) {
  return value ? new Date(value) : null;
}

function bytesToHex(bytes: Uint8Array) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function hexToBytes(hex: string) {
  if (!/^[0-9a-f]+$/iu.test(hex) || hex.length % 2 !== 0) {
    throw new Error("Invalid hexadecimal value.");
  }

  const bytes = new Uint8Array(hex.length / 2);
  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = Number.parseInt(hex.slice(index * 2, index * 2 + 2), 16);
  }
  return bytes;
}

/** Avoids early-exit string comparison for equal-length derived hashes. */
function constantTimeEqual(left: string, right: string) {
  try {
    const leftBytes = hexToBytes(left);
    const rightBytes = hexToBytes(right);
    const length = Math.max(leftBytes.length, rightBytes.length);
    let difference = leftBytes.length ^ rightBytes.length;

    for (let index = 0; index < length; index += 1) {
      difference |= (leftBytes[index] ?? 0) ^ (rightBytes[index] ?? 0);
    }

    return difference === 0;
  } catch {
    return false;
  }
}

function validateCloudflarePassword(password: string): string | null {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres.`;
  }
  if (password.length > MAX_PASSWORD_LENGTH) {
    return `La contraseña no puede superar ${MAX_PASSWORD_LENGTH} caracteres.`;
  }
  if (new TextEncoder().encode(password).byteLength > 512) {
    return "La contraseña es demasiado larga.";
  }
  return null;
}

function randomHex(byteLength = 32) {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return bytesToHex(bytes);
}

async function sha256Hex(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return bytesToHex(new Uint8Array(digest));
}

async function derivePasswordHash(
  password: string,
  saltHex: string,
  iterations = PASSWORD_HASH_ITERATIONS,
) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      salt: hexToBytes(saltHex),
      iterations,
    },
    key,
    256,
  );
  return bytesToHex(new Uint8Array(bits));
}

async function hashPassword(password: string) {
  const salt = randomHex(16);
  const hash = await derivePasswordHash(password, salt);
  return `${PASSWORD_HASH_PREFIX}$${PASSWORD_HASH_ITERATIONS}$${salt}$${hash}`;
}

function readCloudflareEnvValue(name: string) {
  const processValue = process.env[name]?.trim();
  if (processValue) return processValue;

  try {
    const { env } = getCloudflareContext();
    const bindingValue = (env as Record<string, unknown>)[name];
    return typeof bindingValue === "string" ? bindingValue.trim() : "";
  } catch {
    return "";
  }
}

async function secureTextEqual(left: string, right: string) {
  if (!left || !right) return false;
  const [leftHash, rightHash] = await Promise.all([sha256Hex(left), sha256Hex(right)]);
  return leftHash === rightHash;
}

async function verifyPassword(
  password: string,
  storedHash: string | null,
): Promise<PasswordVerification> {
  if (!storedHash) return { valid: false, needsRehash: false };

  const [prefix, iterationsRaw, salt, expectedHash] = storedHash.split("$");
  const iterations = Number(iterationsRaw);
  if (
    prefix !== PASSWORD_HASH_PREFIX ||
    !Number.isInteger(iterations) ||
    iterations < MIN_SUPPORTED_PASSWORD_HASH_ITERATIONS ||
    iterations > MAX_SUPPORTED_PASSWORD_HASH_ITERATIONS ||
    !salt ||
    !expectedHash
  ) {
    return { valid: false, needsRehash: false };
  }

  try {
    const actualHash = await derivePasswordHash(password, salt, iterations);
    return {
      valid: constantTimeEqual(actualHash, expectedHash),
      needsRehash: iterations < PASSWORD_HASH_ITERATIONS,
    };
  } catch {
    return { valid: false, needsRehash: false };
  }
}

function cloudflareOwnerEmails() {
  const configured = [
    DEFAULT_OWNER_EMAIL,
    readCloudflareEnvValue("CLOUDFLARE_OWNER_EMAILS"),
    readCloudflareEnvValue("ADMIN_EMAIL"),
  ]
    .filter(Boolean)
    .join(",");

  return new Set(
    configured
      .split(",")
      .map((entry) => normalizeEmail(entry))
      .filter(Boolean),
  );
}

function getCloudflareOwnerPassword() {
  return readCloudflareEnvValue("CLOUDFLARE_OWNER_PASSWORD");
}

function userFromRow(row: CloudflareAuthUserRow) {
  const createdAt = toDate(row.created_at) ?? new Date();
  const updatedAt = toDate(row.updated_at) ?? createdAt;
  return {
    id: row.id,
    authUserId: row.auth_user_id ?? `cloudflare:${row.id}`,
    email: row.email,
    displayName: row.display_name,
    role: row.role,
    isActive: Boolean(row.is_active),
    lastLoginAt: toDate(row.last_login_at),
    createdAt,
    updatedAt,
  };
}

export async function getCloudflareUserByEmail(email: string) {
  return d1First<CloudflareAuthUserRow>(
    `SELECT id, auth_user_id, email, password_hash, display_name, role, is_active, last_login_at, created_at, updated_at
     FROM cloudflare_auth_user
     WHERE lower(email) = lower(?)
     LIMIT 1`,
    [email],
  );
}

async function ensureConfiguredOwnerForPassword(
  email: string,
  password: string,
  existing: CloudflareAuthUserRow | null,
) {
  if (!cloudflareOwnerEmails().has(email)) return null;

  const ownerPassword = getCloudflareOwnerPassword();
  if (!ownerPassword || !(await secureTextEqual(password, ownerPassword))) {
    return null;
  }

  const timestamp = nowIso();
  const passwordHash = await hashPassword(password);

  if (existing) {
    await d1Run(
      `UPDATE cloudflare_auth_user
       SET auth_user_id = COALESCE(auth_user_id, ?),
           password_hash = ?,
           display_name = COALESCE(display_name, ?),
           role = 'owner',
           is_active = 1,
           updated_at = ?
       WHERE id = ?`,
      [`cloudflare:${existing.id}`, passwordHash, "Owner", timestamp, existing.id],
    );
  } else {
    const id = crypto.randomUUID();
    await d1Run(
      `INSERT INTO cloudflare_auth_user
        (id, auth_user_id, email, password_hash, display_name, role, is_active, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 'owner', 1, ?, ?)`,
      [id, `cloudflare:${id}`, email, passwordHash, "Owner", timestamp, timestamp],
    );
  }

  return getCloudflareUserByEmail(email);
}

async function promoteConfiguredOwner(row: CloudflareAuthUserRow) {
  if (row.role === "owner" || !cloudflareOwnerEmails().has(row.email)) return row;
  await d1Run(
    `UPDATE cloudflare_auth_user
     SET auth_user_id = COALESCE(auth_user_id, ?), role = 'owner', is_active = 1, updated_at = ?
     WHERE id = ?`,
    [`cloudflare:${row.id}`, nowIso(), row.id],
  );
  return (await getCloudflareUserByEmail(row.email)) ?? row;
}

async function countCloudflareUsers() {
  const row = await d1First<{ count: number }>("SELECT COUNT(*) AS count FROM cloudflare_auth_user");
  return Number(row?.count ?? 0);
}

function parseCookie(header: string, name: string) {
  const parts = header.split(";").map((part) => part.trim());
  const prefix = `${name}=`;
  const match = parts.find((part) => part.startsWith(prefix));
  if (!match) return "";
  return decodeURIComponent(match.slice(prefix.length));
}

async function readSessionTokenFromHeaders() {
  try {
    const requestHeaders = await headers();
    return parseCookie(requestHeaders.get("cookie") ?? "", CLOUDFLARE_SESSION_COOKIE);
  } catch {
    return "";
  }
}

export async function getCloudflareSessionUser(): Promise<SessionUserState> {
  const token = await readSessionTokenFromHeaders();
  if (!token) return { status: "unauthenticated", user: null, email: null };

  const tokenHash = await sha256Hex(token);
  const row = await d1First<CloudflareAuthUserRow>(
    `SELECT u.id, u.auth_user_id, u.email, u.password_hash, u.display_name, u.role, u.is_active,
            u.last_login_at, u.created_at, u.updated_at
     FROM cloudflare_auth_session s
     INNER JOIN cloudflare_auth_user u ON u.id = s.user_id
     WHERE s.token_hash = ? AND s.expires_at > ?
     LIMIT 1`,
    [tokenHash, nowIso()],
  );

  if (!row) return { status: "unauthenticated", user: null, email: null };
  const user = userFromRow(row);
  if (!user.isActive) return { status: "inactive", user: user as never, email: user.email };
  return { status: "ok", user: user as never, email: user.email };
}

export async function canSignInWithCloudflareEmail(email: string) {
  const normalized = normalizeEmail(email);
  if (!normalized) return { ok: false as const, error: "Completa correo." };
  const row = await getCloudflareUserByEmail(normalized);
  if (row && !Boolean(row.is_active)) return { ok: false as const, error: "Tu usuario esta desactivado." };
  if (row || isAllowedEmail(normalized)) return { ok: true as const };
  return {
    ok: false as const,
    error: "Correo no autorizado. Necesitas invitacion o dominio @unidep.edu.mx.",
  };
}

export async function canSignUpWithCloudflareEmail(email: string) {
  const normalized = normalizeEmail(email);
  if (!normalized) return false;
  if (await getCloudflareUserByEmail(normalized)) return true;
  return isAllowedEmail(normalized);
}

export async function signInWithCloudflare(input: { email: string; password: string }) {
  const email = normalizeEmail(input.email);
  let row = email ? await getCloudflareUserByEmail(email) : null;
  let verification = row
    ? await verifyPassword(input.password, row.password_hash)
    : { valid: false, needsRehash: false };

  if (!row || !verification.valid) {
    row = email
      ? await ensureConfiguredOwnerForPassword(email, input.password, row)
      : null;
    verification = row
      ? await verifyPassword(input.password, row.password_hash)
      : { valid: false, needsRehash: false };
  }
  if (!row) {
    return { ok: false as const, error: "Credenciales incorrectas." };
  }
  row = await promoteConfiguredOwner(row);
  if (!Boolean(row.is_active)) {
    return { ok: false as const, error: "Tu usuario esta desactivado." };
  }

  if (verification.needsRehash) {
    try {
      await d1Run(
        "UPDATE cloudflare_auth_user SET password_hash = ?, updated_at = ? WHERE id = ?",
        [await hashPassword(input.password), nowIso(), row.id],
      );
    } catch (error) {
      console.warn("Cloudflare password hash rehash failed", { userId: row.id, error });
    }
  }

  const token = randomHex(32);
  const expiresAt = new Date(Date.now() + SESSION_TTL_SECONDS * 1000).toISOString();
  await d1Run("INSERT INTO cloudflare_auth_session (token_hash, user_id, expires_at) VALUES (?, ?, ?)", [
    await sha256Hex(token),
    row.id,
    expiresAt,
  ]);
  await d1Run("UPDATE cloudflare_auth_user SET last_login_at = ?, updated_at = ? WHERE id = ?", [
    nowIso(),
    nowIso(),
    row.id,
  ]);

  return { ok: true as const, token, expiresAt, user: userFromRow(row) };
}

export async function signUpWithCloudflare(input: {
  email: string;
  password: string;
  displayName?: string | null;
}) {
  const email = normalizeEmail(input.email);
  if (!email || !input.password) return { ok: false as const, error: "Completa correo y contraseña." };

  const passwordError = validateCloudflarePassword(input.password);
  if (passwordError) return { ok: false as const, error: passwordError };

  if (!(await canSignUpWithCloudflareEmail(email))) {
    return {
      ok: false as const,
      error: "Correo no autorizado. Necesitas invitacion o dominio @unidep.edu.mx.",
    };
  }

  const existing = await getCloudflareUserByEmail(email);
  if (existing) return { ok: false as const, error: "Ya existe una cuenta con este correo." };

  const id = crypto.randomUUID();
  const explicitOwner = cloudflareOwnerEmails().has(email);
  const timestamp = nowIso();

  try {
    await d1Run(
      `INSERT INTO cloudflare_auth_user
        (id, auth_user_id, email, password_hash, display_name, role, is_active, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?,
         CASE
           WHEN ? = 1 THEN 'owner'
           WHEN NOT EXISTS (SELECT 1 FROM cloudflare_auth_user) THEN 'owner'
           ELSE 'user'
         END,
         1, ?, ?)`,
      [
        id,
        `cloudflare:${id}`,
        email,
        await hashPassword(input.password),
        input.displayName ?? email.split("@")[0] ?? "Usuario",
        explicitOwner ? 1 : 0,
        timestamp,
        timestamp,
      ],
    );
  } catch (error) {
    if (error instanceof Error && /unique|constraint/i.test(error.message)) {
      return { ok: false as const, error: "Ya existe una cuenta con este correo." };
    }
    throw error;
  }

  return signInWithCloudflare({ email, password: input.password });
}

export async function signOutCloudflareSession() {
  const token = await readSessionTokenFromHeaders();
  if (token) {
    await d1Run("DELETE FROM cloudflare_auth_session WHERE token_hash = ?", [await sha256Hex(token)]);
  }
}

export function setCloudflareSessionCookie(
  response: NextResponse,
  token: string,
  expiresAt: string,
) {
  response.cookies.set(CLOUDFLARE_SESSION_COOKIE, token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    expires: new Date(expiresAt),
  });
}

export function clearCloudflareSessionCookie(response: NextResponse) {
  response.cookies.set(CLOUDFLARE_SESSION_COOKIE, "", {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

export async function clearCloudflareSessionCookieFromStore() {
  const cookieStore = await cookies();
  cookieStore.set(CLOUDFLARE_SESSION_COOKIE, "", {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}
