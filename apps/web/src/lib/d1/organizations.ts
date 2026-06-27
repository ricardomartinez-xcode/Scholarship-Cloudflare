import type { AppD1Database, JsonObject } from "./contracts";
import { assertNonEmpty } from "./errors";
import { newId, nowIso } from "./ids";
import { stringifyJson } from "./json";
import { writeAuditEvent } from "./audit";

export type OrganizationRole = "owner" | "admin" | "operator" | "viewer";

export interface CreateOrganizationInput {
  slug: string;
  name: string;
  ownerUserId: string;
  settings?: JsonObject;
  actorUserId: string;
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
    after: { slug: input.slug.trim().toLowerCase(), name: input.name.trim() },
  });

  return { organizationId, membershipId };
}
