import type { AppD1Database } from "./contracts";
import { parseJsonObject } from "./json";

export interface D1AuditLogFilters {
  page: number;
  pageSize: number;
  action?: string | null;
  resourceType?: string | null;
  actor?: string | null;
  from?: string | null;
  to?: string | null;
}

interface CountRow {
  total: number | string;
}

interface AuditRow {
  id: string;
  organization_id: string | null;
  actor_user_id: string | null;
  actor_email: string | null;
  actor_type: string;
  action: string;
  resource_type: string;
  resource_id: string | null;
  request_id: string | null;
  metadata_json: string | null;
  created_at: string;
}

export interface D1AuditLogEvent {
  id: string;
  organizationId: string | null;
  action: string;
  resourceType: string;
  resourceId: string | null;
  requestId: string | null;
  actor: {
    id: string | null;
    email: string | null;
    type: string;
  };
  metadata: Record<string, unknown>;
  createdAt: string;
}

function clean(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? "";
  return trimmed || null;
}

function validDate(value: string | null | undefined): string | null {
  const candidate = clean(value);
  if (!candidate || Number.isNaN(Date.parse(candidate))) return null;
  return candidate;
}

/**
 * Reads only from the Cloudflare-native audit ledger. Values are bound; query
 * parameters never become identifiers or SQL fragments.
 */
export async function listD1AuditEvents(
  db: AppD1Database,
  filters: D1AuditLogFilters,
): Promise<{ total: number; events: D1AuditLogEvent[] }> {
  const where: string[] = [];
  const params: unknown[] = [];

  const action = clean(filters.action);
  const resourceType = clean(filters.resourceType);
  const actor = clean(filters.actor);
  const from = validDate(filters.from);
  const to = validDate(filters.to);

  if (action) {
    where.push("lower(e.action) = lower(?)");
    params.push(action);
  }
  if (resourceType) {
    where.push("lower(e.resource_type) = lower(?)");
    params.push(resourceType);
  }
  if (actor) {
    where.push("lower(COALESCE(u.email, '')) LIKE lower(?)");
    params.push(`%${actor}%`);
  }
  if (from) {
    where.push("e.created_at >= ?");
    params.push(from);
  }
  if (to) {
    where.push("e.created_at <= ?");
    params.push(to);
  }

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const joins = "LEFT JOIN cloudflare_auth_user u ON u.id = e.actor_user_id";
  const count = await db
    .prepare(`SELECT COUNT(*) AS total FROM admin_audit_event e ${joins} ${whereSql}`)
    .bind(...params)
    .first<CountRow>();

  const offset = Math.max(0, (filters.page - 1) * filters.pageSize);
  const rows = await db
    .prepare(
      `SELECT
        e.id,
        e.organization_id,
        e.actor_user_id,
        u.email AS actor_email,
        e.actor_type,
        e.action,
        e.resource_type,
        e.resource_id,
        e.request_id,
        e.metadata_json,
        e.created_at
      FROM admin_audit_event e
      ${joins}
      ${whereSql}
      ORDER BY e.created_at DESC, e.id DESC
      LIMIT ? OFFSET ?`,
    )
    .bind(...params, filters.pageSize, offset)
    .all<AuditRow>();

  return {
    total: Number(count?.total ?? 0),
    events: (rows.results ?? []).map((row) => ({
      id: row.id,
      organizationId: row.organization_id,
      action: row.action,
      resourceType: row.resource_type,
      resourceId: row.resource_id,
      requestId: row.request_id,
      actor: {
        id: row.actor_user_id,
        email: row.actor_email,
        type: row.actor_type,
      },
      metadata: parseJsonObject(row.metadata_json),
      createdAt: row.created_at,
    })),
  };
}
