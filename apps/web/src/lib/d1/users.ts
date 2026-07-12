import type { AppD1Database } from "./contracts";
import { writeAuditEvent } from "./audit";
import { nowIso } from "./ids";

export const CLOUDFLARE_AUTH_ROLES = [
  "owner",
  "admin_operativo",
  "editor_operativo",
  "user",
] as const;

export type CloudflareAuthRole = (typeof CLOUDFLARE_AUTH_ROLES)[number];
export type CloudflareAuthStatus = "active" | "inactive";

export interface D1AuthUser {
  id: string;
  email: string;
  displayName: string | null;
  role: CloudflareAuthRole;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  lastLoginAt: string | null;
}

export interface ListD1AuthUsersFilters {
  page: number;
  pageSize: number;
  query?: string | null;
  role?: CloudflareAuthRole | null;
  status?: CloudflareAuthStatus | null;
}

interface UserRow {
  id: string;
  email: string;
  display_name: string | null;
  role: string;
  is_active: number | boolean;
  created_at: string;
  updated_at: string;
  last_login_at: string | null;
}

interface CountRow {
  total: number | string;
}

export function isCloudflareAuthRole(value: unknown): value is CloudflareAuthRole {
  return (
    typeof value === "string" &&
    (CLOUDFLARE_AUTH_ROLES as readonly string[]).includes(value)
  );
}

function mapUser(row: UserRow): D1AuthUser {
  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    role: isCloudflareAuthRole(row.role) ? row.role : "user",
    isActive: row.is_active === true || row.is_active === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastLoginAt: row.last_login_at,
  };
}

function clean(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? "";
  return trimmed || null;
}

/**
 * Lists Cloudflare-native users only. Legacy Prisma users are deliberately not
 * read in Worker runtime so this endpoint never silently falls back to an
 * external PostgreSQL database.
 */
export async function listD1AuthUsers(
  db: AppD1Database,
  filters: ListD1AuthUsersFilters,
): Promise<{ total: number; users: D1AuthUser[] }> {
  const where: string[] = [];
  const params: unknown[] = [];
  const query = clean(filters.query);

  if (query) {
    where.push(
      "(lower(email) LIKE lower(?) OR lower(COALESCE(display_name, '')) LIKE lower(?))",
    );
    params.push(`%${query}%`, `%${query}%`);
  }
  if (filters.role) {
    where.push("role = ?");
    params.push(filters.role);
  }
  if (filters.status === "active") {
    where.push("is_active = 1");
  }
  if (filters.status === "inactive") {
    where.push("is_active = 0");
  }

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const count = await db
    .prepare(`SELECT COUNT(*) AS total FROM cloudflare_auth_user ${whereSql}`)
    .bind(...params)
    .first<CountRow>();

  const offset = Math.max(0, (filters.page - 1) * filters.pageSize);
  const rows = await db
    .prepare(
      `SELECT id, email, display_name, role, is_active, created_at, updated_at, last_login_at
       FROM cloudflare_auth_user
       ${whereSql}
       ORDER BY created_at DESC, id DESC
       LIMIT ? OFFSET ?`,
    )
    .bind(...params, filters.pageSize, offset)
    .all<UserRow>();

  return {
    total: Number(count?.total ?? 0),
    users: (rows.results ?? []).map(mapUser),
  };
}

export async function findD1AuthUser(
  db: AppD1Database,
  id: string,
): Promise<D1AuthUser | null> {
  const row = await db
    .prepare(
      `SELECT id, email, display_name, role, is_active, created_at, updated_at, last_login_at
       FROM cloudflare_auth_user
       WHERE id = ?
       LIMIT 1`,
    )
    .bind(id)
    .first<UserRow>();

  return row ? mapUser(row) : null;
}

export type UpdateD1AuthUserRoleResult =
  | { ok: true; user: D1AuthUser }
  | { ok: false; reason: "not_found" | "last_owner_guard" };

/**
 * The conditional UPDATE keeps the final active owner from being demoted even
 * when two role changes arrive concurrently. The write predicate is evaluated
 * by SQLite at update time rather than trusting a prior count query alone.
 */
export async function updateD1AuthUserRole(
  db: AppD1Database,
  input: {
    id: string;
    role: CloudflareAuthRole;
    actorUserId: string;
    requestId?: string | null;
  },
): Promise<UpdateD1AuthUserRoleResult> {
  const current = await findD1AuthUser(db, input.id);
  if (!current) return { ok: false, reason: "not_found" };

  const updatedAt = nowIso();
  const result = await db
    .prepare(
      `UPDATE cloudflare_auth_user
       SET role = ?, updated_at = ?
       WHERE id = ?
         AND (
           (SELECT role FROM cloudflare_auth_user WHERE id = ?) <> 'owner'
           OR ? = 'owner'
           OR EXISTS (
             SELECT 1
             FROM cloudflare_auth_user AS other_owner
             WHERE other_owner.id <> ?
               AND other_owner.role = 'owner'
               AND other_owner.is_active = 1
           )
         )`,
    )
    .bind(input.role, updatedAt, input.id, input.id, input.role, input.id)
    .run();

  if (Number(result.meta?.changes ?? 0) !== 1) {
    const latest = await findD1AuthUser(db, input.id);
    if (!latest) return { ok: false, reason: "not_found" };
    if (latest.role === "owner" && input.role !== "owner") {
      return { ok: false, reason: "last_owner_guard" };
    }
    return { ok: true, user: latest };
  }

  const user = await findD1AuthUser(db, input.id);
  if (!user) return { ok: false, reason: "not_found" };

  await writeAuditEvent(db, {
    actorUserId: input.actorUserId,
    action: "user.role_updated",
    resourceType: "cloudflare_auth_user",
    resourceId: input.id,
    requestId: input.requestId ?? null,
    before: { role: current.role },
    after: { role: user.role },
    metadata: { targetEmail: user.email },
  });

  return { ok: true, user };
}
