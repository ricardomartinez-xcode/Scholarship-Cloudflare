import "server-only";

import { realtimeTopics } from "@/lib/realtime-topics";

type BroadcastPayload = {
  topic: string;
  event: string;
  payload: Record<string, unknown>;
  privateChannel?: boolean;
};

async function sendBroadcastMessage({
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
    console.error("Failed to broadcast Supabase event:", await response.text());
    return false;
  }

  return true;
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
    privateChannel: true,
  });
}
