import type { AppD1Database, JsonObject } from "./contracts";
import { newId } from "./ids";
import { stringifyJson } from "./json";

export interface AuditEventInput {
  organizationId?: string | null;
  actorUserId?: string | null;
  actorType?: "user" | "service" | "system";
  action: string;
  resourceType: string;
  resourceId?: string | null;
  requestId?: string | null;
  ipHash?: string | null;
  userAgentHash?: string | null;
  before?: JsonObject | null;
  after?: JsonObject | null;
  metadata?: JsonObject;
}

export async function writeAuditEvent(
  db: AppD1Database,
  input: AuditEventInput,
): Promise<string> {
  const id = newId("audit");

  await db
    .prepare(
      `INSERT INTO admin_audit_event (
        id, organization_id, actor_user_id, actor_type, action,
        resource_type, resource_id, request_id, ip_hash, user_agent_hash,
        before_json, after_json, metadata_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      id,
      input.organizationId ?? null,
      input.actorUserId ?? null,
      input.actorType ?? "user",
      input.action,
      input.resourceType,
      input.resourceId ?? null,
      input.requestId ?? null,
      input.ipHash ?? null,
      input.userAgentHash ?? null,
      input.before ? stringifyJson(input.before) : null,
      input.after ? stringifyJson(input.after) : null,
      stringifyJson(input.metadata),
    )
    .run();

  return id;
}
