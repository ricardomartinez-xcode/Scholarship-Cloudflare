import type { AppD1Database, JsonObject } from "./contracts";
import { newId, nowIso } from "./ids";
import { stringifyJson } from "./json";

export type ConversationChannel = "app" | "whatsapp" | "meta" | "email" | "internal";
export type MessageDirection = "inbound" | "outbound" | "internal";

export interface CreateConversationInput {
  organizationId?: string | null;
  channel: ConversationChannel;
  title?: string | null;
  externalThreadId?: string | null;
  assignedToUserId?: string | null;
  metadata?: JsonObject;
}

export async function createConversation(
  db: AppD1Database,
  input: CreateConversationInput,
): Promise<string> {
  const id = newId("conv");
  const now = nowIso();

  await db
    .prepare(
      `INSERT INTO conversation (
        id, organization_id, channel, external_thread_id, title,
        assigned_to_user_id, metadata_json, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      id,
      input.organizationId ?? null,
      input.channel,
      input.externalThreadId ?? null,
      input.title ?? null,
      input.assignedToUserId ?? null,
      stringifyJson(input.metadata),
      now,
      now,
    )
    .run();

  return id;
}

export async function appendConversationMessage(
  db: AppD1Database,
  input: {
    conversationId: string;
    senderMemberId?: string | null;
    direction: MessageDirection;
    externalMessageId?: string | null;
    contentText?: string | null;
    content?: JsonObject;
    status?: "accepted" | "queued" | "sent" | "delivered" | "failed" | "read";
    sentAt?: string | null;
    receivedAt?: string | null;
    enqueueTopic?: string | null;
  },
): Promise<string> {
  const messageId = newId("msg");
  const eventId = newId("outbox");
  const now = nowIso();

  const statements = [
    db
      .prepare(
        `INSERT INTO conversation_message (
          id, conversation_id, sender_member_id, direction, external_message_id,
          content_text, content_json, status, sent_at, received_at, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        messageId,
        input.conversationId,
        input.senderMemberId ?? null,
        input.direction,
        input.externalMessageId ?? null,
        input.contentText ?? null,
        stringifyJson(input.content),
        input.status ?? "accepted",
        input.sentAt ?? null,
        input.receivedAt ?? null,
        now,
      ),
    db
      .prepare(
        `UPDATE conversation
         SET last_message_at = ?, updated_at = ?
         WHERE id = ?`,
      )
      .bind(now, now, input.conversationId),
  ];

  if (input.enqueueTopic) {
    statements.push(
      db
        .prepare(
          `INSERT INTO outbox_event (
            id, topic, aggregate_type, aggregate_id, payload_json,
            status, created_at
          ) VALUES (?, ?, 'conversation_message', ?, ?, 'pending', ?)`,
        )
        .bind(
          eventId,
          input.enqueueTopic,
          messageId,
          stringifyJson({ conversationId: input.conversationId, messageId }),
          now,
        ),
    );
  }

  await db.batch(statements);
  return messageId;
}
