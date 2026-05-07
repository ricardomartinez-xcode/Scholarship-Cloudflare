import { broadcastInboxMessage } from "@/lib/supabase/server-realtime";
import type { RealtimeMessagePayload } from "@relead/realtime/types";

export async function broadcastNewMessage(payload: RealtimeMessagePayload) {
  await broadcastInboxMessage(payload.threadId, payload);
}
