import type { AppD1Database } from "./contracts";
import { newId, nowIso } from "./ids";
import { stringifyJson } from "./json";

export interface EnqueueOutboxEventInput {
  organizationId?: string | null;
  topic: string;
  aggregateType: string;
  aggregateId: string;
  payload: unknown;
  availableAt?: string;
}

/**
 * Records a durable event for a future Queue, Workflow or Durable Object
 * consumer. It does not claim network delivery; callers only receive an
 * acknowledgement that D1 accepted the event.
 */
export async function enqueueOutboxEvent(
  db: AppD1Database,
  input: EnqueueOutboxEventInput,
): Promise<string> {
  const id = newId("outbox");
  const now = nowIso();

  await db
    .prepare(
      `INSERT INTO outbox_event (
        id, organization_id, topic, aggregate_type, aggregate_id, payload_json,
        status, attempts, available_at, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, 'pending', 0, ?, ?)`,
    )
    .bind(
      id,
      input.organizationId ?? null,
      input.topic,
      input.aggregateType,
      input.aggregateId,
      stringifyJson(input.payload),
      input.availableAt ?? now,
      now,
    )
    .run();

  return id;
}
