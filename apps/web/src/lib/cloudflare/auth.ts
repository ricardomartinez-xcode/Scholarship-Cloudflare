import { cookies, headers } from "next/headers";
import type { NextResponse } from "next/server";

import { isAllowedEmail } from "@/lib/domain";
import { normalizeEmail } from "@/lib/normalize";
import type { SessionUserState } from "@/lib/authz";
import { d1First, d1Run } from "@/lib/cloudflare/d1";

export const CLOUDFLARE_SESSION_COOKIE = "recalc_cf_session";

const PASSWORD_HASH_PREFIX = "pbkdf2-sha256";
const PASSWORD_HASH_ITERATIONS = 120_000;
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30;

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
  const bytes = new Uint8Array(hex.length / 2);
  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = Number.parseInt(hex.slice(index * 2, index * 2 + 2), 16);
  }
  return bytes;
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

async function derivePasswordHash(password: string, saltHex: string, iterations = PASSWORD_HASH_ITERATIONS) {
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

async function verifyPassword(password: string, storedHash: string | null) {
  if (!storedHash) return false;
  const [prefix, iterationsRaw, salt, expectedHash] = storedHash.split("$");
  const iterations = Number(iterationsRaw);
  if (prefix !== PASSWORD_HASH_PREFIX || !Number.isFinite(iterations) || !salt || !expectedHash) {
    return false;
  }
  const actualHash = await derivePasswordHash(password, salt, iterations);
  return actualHash === expectedHash;
}

function cloudflareOwnerEmails() {
  return new Set(
    String(process.env.CLOUDFLARE_OWNER_EMAILS ?? process.env.ADMIN_EMAIL ?? "")
      .split(",")
      .map((entry) => normalizeEmail(entry))
      .filter(Boolean),
  );
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

async function getCloudflareUserByEmail(email: string) {
  return d1First<CloudflareAuthUserRow>(
    `SELECT id, auth_user_id, email, password_hash, display_name, role, is_active, last_login_at, created_at, updated_at
     FROM cloudflare_auth_user
     WHERE lower(email) = lower(?)
     LIMIT 1`,
    [email],
  );
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
  const row = email ? await getCloudflareUserByEmail(email) : null;
  if (!row || !(await verifyPassword(input.password, row.password_hash))) {
    return { ok: false as const, error: "Credenciales incorrectas." };
  }
  if (!Boolean(row.is_active)) {
    return { ok: false as const, error: "Tu usuario esta desactivado." };
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

  return { ok: true as const, token, expiresAt };
}

export async function signUpWithCloudflare(input: { email: string; password: string; displayName?: string | null }) {
  const email = normalizeEmail(input.email);
  if (!email || !input.password) return { ok: false as const, error: "Completa correo y contraseña." };
  if (!(await canSignUpWithCloudflareEmail(email))) {
    return {
      ok: false as const,
      error: "Correo no autorizado. Necesitas invitacion o dominio @unidep.edu.mx.",
    };
  }

  const existing = await getCloudflareUserByEmail(email);
  if (existing) return { ok: false as const, error: "Ya existe una cuenta con este correo." };

  const id = crypto.randomUUID();
  const owners = cloudflareOwnerEmails();
  const role = owners.has(email) || (await countCloudflareUsers()) === 0 ? "owner" : "user";
  const timestamp = nowIso();
  await d1Run(
    `INSERT INTO cloudflare_auth_user
      (id, auth_user_id, email, password_hash, display_name, role, is_active, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)`,
    [
      id,
      `cloudflare:${id}`,
      email,
      await hashPassword(input.password),
      input.displayName ?? email.split("@")[0] ?? "Usuario",
      role,
      timestamp,
      timestamp,
    ],
  );

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
