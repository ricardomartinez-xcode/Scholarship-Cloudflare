import type { AppD1Database, JsonObject } from "./contracts";
import { assertNonEmpty } from "./errors";
import { newId, nowIso } from "./ids";
import { stringifyJson } from "./json";
import { writeAuditEvent } from "./audit";

export type OrganizationRole = "owner" | "admin" | "operator" | "viewer";
export type OrganizationStatus = "active" | "suspended" | "archived";

export interface CreateOrganizationInput {
  slug: string;
  name: string;
  ownerUserId: string;
  settings?: JsonObject;
  actorUserId: string;
  requestId?: string | null;
}

export interface D1OrganizationSummary {
  id: string;
  slug: string;
  name: string;
  status: OrganizationStatus;
  createdAt: string;
  memberCount: number;
}

interface OrganizationRow {
  id: string;
  slug: string;
  name: string;
  status: OrganizationStatus;
  created_at: string;
  member_count?: number | string | null;
}

function mapOrganization(row: OrganizationRow): D1OrganizationSummary {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    status: row.status,
    createdAt: row.created_at,
    memberCount: Number(row.member_count ?? 0),
  };
}

/** Keeps slugs stable, URL-safe and deterministic for D1's unique key. */
export function organizationSlugFromName(value: string): string {
  const normalized = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72);

  return normalized || "organizacion";
}

async function slugExists(db: AppD1Database, slug: string): Promise<boolean> {
  const row = await db
    .prepare("SELECT id FROM organization WHERE slug = ? LIMIT 1")
    .bind(slug)
    .first<{ id: string }>();
  return Boolean(row?.id);
}

/**
 * Produces a collision-free slug without changing an organization's existing
 * slug on later display-name edits.
 */
export async function nextOrganizationSlug(
  db: AppD1Database,
  name: string,
): Promise<string> {
  const base = organizationSlugFromName(name);
  if (!(await slugExists(db, base))) return base;

  for (let suffix = 2; suffix <= 1000; suffix += 1) {
    const candidate = `${base.slice(0, Math.max(1, 72 - String(suffix).length - 1))}-${suffix}`;
    if (!(await slugExists(db, candidate))) return candidate;
  }

  return `${base.slice(0, 56)}-${newId("org").slice(-12)}`;
}

export async function listActiveOrganizations(
  db: AppD1Database,
): Promise<D1OrganizationSummary[]> {
  const rows = await db
    .prepare(
      `SELECT
        o.id,
        o.slug,
        o.name,
        o.status,
        o.created_at,
        COUNT(m.id) AS member_count
      FROM organization o
      LEFT JOIN organization_member m ON m.organization_id = o.id
      WHERE o.status = 'active'
      GROUP BY o.id, o.slug, o.name, o.status, o.created_at
      ORDER BY o.created_at DESC, o.id DESC`,
    )
    .all<OrganizationRow>();

  return (rows.results ?? []).map(mapOrganization);
}

export async function findActiveOrganizationByName(
  db: AppD1Database,
  name: string,
  options?: { exceptId?: string },
): Promise<D1OrganizationSummary | null> {
  const exceptId = options?.exceptId?.trim() || null;
  const row = await db
    .prepare(
      `SELECT
        o.id,
        o.slug,
        o.name,
        o.status,
        o.created_at,
        COUNT(m.id) AS member_count
      FROM organization o
      LEFT JOIN organization_member m ON m.organization_id = o.id
      WHERE o.status = 'active'
        AND lower(o.name) = lower(?)
        AND (? IS NULL OR o.id <> ?)
      GROUP BY o.id, o.slug, o.name, o.status, o.created_at
      LIMIT 1`,
    )
    .bind(name.trim(), exceptId, exceptId)
    .first<OrganizationRow>();

  return row ? mapOrganization(row) : null;
}

export async function findActiveOrganization(
  db: AppD1Database,
  id: string,
): Promise<D1OrganizationSummary | null> {
  const row = await db
    .prepare(
      `SELECT
        o.id,
        o.slug,
        o.name,
        o.status,
        o.created_at,
        COUNT(m.id) AS member_count
      FROM organization o
      LEFT JOIN organization_member m ON m.organization_id = o.id
      WHERE o.id = ? AND o.status = 'active'
      GROUP BY o.id, o.slug, o.name, o.status, o.created_at
      LIMIT 1`,
    )
    .bind(id)
    .first<OrganizationRow>();

  return row ? mapOrganization(row) : null;
}

export async function createOrganization(
  db: AppD1Database,
  input: CreateOrganizationInput,
): Promise<{ organizationId: string; membershipId: string }> {
  assertNonEmpty(input.slug, "slug");
  assertNonEmpty(input.name, "name");
  assertNonEmpty(input.ownerUserId, "ownerUserId");

  const organizationId = newId("org");
  const membershipId = newId("orgm");
  const now = nowIso();

  const statements = [
    db
      .prepare(
        `INSERT INTO organization (
          id, slug, name, status, settings_json, created_at, updated_at
        ) VALUES (?, ?, ?, 'active', ?, ?, ?)`,
      )
      .bind(
        organizationId,
        input.slug.trim().toLowerCase(),
        input.name.trim(),
        stringifyJson(input.settings),
        now,
        now,
      ),
    db
      .prepare(
        `INSERT INTO organization_member (
          id, organization_id, user_id, role, status, created_at, updated_at
        ) VALUES (?, ?, ?, 'owner', 'active', ?, ?)`,
      )
      .bind(membershipId, organizationId, input.ownerUserId, now, now),
  ];

  await db.batch(statements);

  await writeAuditEvent(db, {
    organizationId,
    actorUserId: input.actorUserId,
    action: "organization.created",
    resourceType: "organization",
    resourceId: organizationId,
    requestId: input.requestId ?? null,
    after: { slug: input.slug.trim().toLowerCase(), name: input.name.trim() },
  });

  return { organizationId, membershipId };
}

export async function renameOrganization(
  db: AppD1Database,
  input: {
    id: string;
    name: string;
    actorUserId: string;
    requestId?: string | null;
  },
): Promise<D1OrganizationSummary | null> {
  const current = await findActiveOrganization(db, input.id);
  if (!current) return null;

  const name = input.name.trim();
  assertNonEmpty(name, "name");
  const now = nowIso();

  await db
    .prepare(
      `UPDATE organization
       SET name = ?, updated_at = ?
       WHERE id = ? AND status = 'active'`,
    )
    .bind(name, now, input.id)
    .run();

  await writeAuditEvent(db, {
    organizationId: input.id,
    actorUserId: input.actorUserId,
    action: "organization.updated",
    resourceType: "organization",
    resourceId: input.id,
    requestId: input.requestId ?? null,
    before: { name: current.name },
    after: { name },
  });

  return {
    ...current,
    name,
  };
}

export async function archiveOrganizations(
  db: AppD1Database,
  input: {
    ids: string[];
    actorUserId: string;
    requestId?: string | null;
  },
): Promise<D1OrganizationSummary[]> {
  const ids = Array.from(new Set(input.ids.map((id) => id.trim()).filter(Boolean)));
  if (!ids.length) return [];

  const placeholders = ids.map(() => "?").join(", ");
  const rows = await db
    .prepare(
      `SELECT
        o.id,
        o.slug,
        o.name,
        o.status,
        o.created_at,
        COUNT(m.id) AS member_count
      FROM organization o
      LEFT JOIN organization_member m ON m.organization_id = o.id
      WHERE o.status = 'active' AND o.id IN (${placeholders})
      GROUP BY o.id, o.slug, o.name, o.status, o.created_at`,
    )
    .bind(...ids)
    .all<OrganizationRow>();
  const current = (rows.results ?? []).map(mapOrganization);

  if (!current.length) return [];

  const now = nowIso();
  await db.batch(
    current.map((organization) =>
      db
        .prepare(
          `UPDATE organization
           SET status = 'archived', updated_at = ?
           WHERE id = ? AND status = 'active'`,
        )
        .bind(now, organization.id),
    ),
  );

  await Promise.all(
    current.map((organization) =>
      writeAuditEvent(db, {
        organizationId: organization.id,
        actorUserId: input.actorUserId,
        action: "organization.archived",
        resourceType: "organization",
        resourceId: organization.id,
        requestId: input.requestId ?? null,
        before: { name: organization.name, status: organization.status },
        after: { status: "archived" },
      }),
    ),
  );

  return current;
}
