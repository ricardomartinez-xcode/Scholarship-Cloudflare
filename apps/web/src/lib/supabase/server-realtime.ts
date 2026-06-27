import "server-only";

import { getD1 } from "@/lib/cloudflare/d1";
import { isCloudflareRuntime } from "@/lib/cloudflare/runtime";
import { enqueueOutboxEvent } from "@/lib/d1/outbox";
import { parseRealtimeTopic, realtimeTopics } from "@/lib/realtime-topics";

type BroadcastPayload = {
  topic: string;
  event: string;
  payload: Record<string, unknown>;
  privateChannel?: boolean;
};

async function resolveInboxOrganizationId(threadId: string): Promise<string | null> {
  const row = await getD1()
    .prepare(
      `SELECT organization_id
       FROM conversation
       WHERE id = ? OR external_thread_id = ?
       ORDER BY updated_at DESC
       LIMIT 1`,
    )
    .bind(threadId, threadId)
    .first<{ organization_id: string | null }>();

  return row?.organization_id ?? null;
}

async function writeCloudflareRealtimeEvent({
  topic,
  event,
  payload,
  privateChannel = false,
}: BroadcastPayload): Promise<boolean> {
  try {
    const descriptor = parseRealtimeTopic(topic);
    const organizationId =
      descriptor?.kind === "inbox-thread-messages" ||
      descriptor?.kind === "inbox-thread-presence"
        ? await resolveInboxOrganizationId(descriptor.threadId)
        : null;

    await enqueueOutboxEvent(getD1(), {
      organizationId,
      topic,
      aggregateType: "realtime_topic",
      aggregateId: topic,
      payload: {
        event,
        payload,
        privateChannel,
      },
    });
    return true;
  } catch (error) {
    console.error("Failed to persist Cloudflare realtime event", {
      topic,
      event,
      error,
    });
    return false;
  }
}

async function sendSupabaseBroadcastMessage({
  topic,
  event,
  payload,
  privateChannel = false,
}: BroadcastPayload) {
  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return false;
  }

  try {
    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/broadcast`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
      },
      body: JSON.stringify({
        topic,
        event,
        payload,
        private: privateChannel,
      }),
      cache: "no-store",
    });

    if (!response.ok) {
      console.error("Failed to broadcast Supabase event", {
        topic,
        event,
        status: response.status,
      });
      return false;
    }

    return true;
  } catch (error) {
    console.error("Failed to broadcast Supabase event", { topic, event, error });
    return false;
  }
}

async function sendBroadcastMessage(message: BroadcastPayload) {
  if (isCloudflareRuntime()) {
    return writeCloudflareRealtimeEvent(message);
  }

  return sendSupabaseBroadcastMessage(message);
}

export async function broadcastTrainingMessage(
  chatId: string,
  payload: Record<string, unknown>,
) {
  return sendBroadcastMessage({
    topic: realtimeTopics.trainingChatMessages(chatId),
    event: "new_message",
    payload,
    privateChannel: true,
  });
}

export async function broadcastInboxMessage(
  threadId: string,
  payload: Record<string, unknown>,
) {
  return sendBroadcastMessage({
    topic: realtimeTopics.inboxThreadMessages(threadId),
    event: "new_message",
    payload,
    privateChannel: false,
  });
}
