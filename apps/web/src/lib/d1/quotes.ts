import type { AppD1Database, JsonObject } from "./contracts";
import { newId, nowIso } from "./ids";
import { stringifyJson } from "./json";
import { writeAuditEvent } from "./audit";

export interface CreateQuoteSessionInput {
  organizationId?: string | null;
  createdByUserId?: string | null;
  enrollmentType: string;
  businessLine: string;
  modality: string;
  plan: number;
  campusKey?: string | null;
  average?: number | null;
  subjectCount?: number | null;
  input: JsonObject;
  expiresAt?: string | null;
}

export interface CreateQuoteScenarioInput {
  quoteSessionId: string;
  sequence: number;
  label?: string | null;
  input: JsonObject;
  pricingSnapshot: JsonObject;
  scholarshipSnapshot?: JsonObject;
  result: JsonObject;
  totalAmount?: number | null;
  currency?: string;
  actorUserId?: string | null;
}

export async function createQuoteSession(
  db: AppD1Database,
  input: CreateQuoteSessionInput,
): Promise<string> {
  const id = newId("quote");
  const now = nowIso();

  await db.batch([
    db
      .prepare(
        `INSERT INTO quote_session (
          id, organization_id, created_by_user_id, enrollment_type, business_line,
          modality, plan, campus_key, average, subject_count, input_json,
          created_at, updated_at, expires_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        id,
        input.organizationId ?? null,
        input.createdByUserId ?? null,
        input.enrollmentType,
        input.businessLine,
        input.modality,
        input.plan,
        input.campusKey ?? null,
        input.average ?? null,
        input.subjectCount ?? null,
        stringifyJson(input.input),
        now,
        now,
        input.expiresAt ?? null,
      ),
    db
      .prepare(
        `INSERT INTO quote_event (
          id, quote_session_id, event_type, actor_user_id, event_json, created_at
        ) VALUES (?, ?, 'created', ?, ?, ?)`,
      )
      .bind(newId("qev"), id, input.createdByUserId ?? null, stringifyJson(input.input), now),
  ]);

  return id;
}

export async function createQuoteScenario(
  db: AppD1Database,
  input: CreateQuoteScenarioInput,
): Promise<string> {
  const id = newId("scenario");
  const eventId = newId("qev");
  const now = nowIso();

  await db.batch([
    db
      .prepare(
        `INSERT INTO quote_scenario (
          id, quote_session_id, sequence, label, input_json, pricing_snapshot_json,
          scholarship_snapshot_json, result_json, total_amount, currency, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        id,
        input.quoteSessionId,
        input.sequence,
        input.label ?? null,
        stringifyJson(input.input),
        stringifyJson(input.pricingSnapshot),
        stringifyJson(input.scholarshipSnapshot),
        stringifyJson(input.result),
        input.totalAmount ?? null,
        input.currency ?? "MXN",
        now,
      ),
    db
      .prepare(
        `INSERT INTO quote_event (
          id, quote_session_id, scenario_id, event_type, actor_user_id, event_json, created_at
        ) VALUES (?, ?, ?, 'scenario_created', ?, ?, ?)`,
      )
      .bind(
        eventId,
        input.quoteSessionId,
        id,
        input.actorUserId ?? null,
        stringifyJson({ sequence: input.sequence, totalAmount: input.totalAmount ?? null }),
        now,
      ),
    db
      .prepare(`UPDATE quote_session SET updated_at = ? WHERE id = ?`)
      .bind(now, input.quoteSessionId),
  ]);

  await writeAuditEvent(db, {
    actorUserId: input.actorUserId ?? null,
    action: "quote.scenario_created",
    resourceType: "quote_session",
    resourceId: input.quoteSessionId,
    after: { scenarioId: id, sequence: input.sequence },
  });

  return id;
}
