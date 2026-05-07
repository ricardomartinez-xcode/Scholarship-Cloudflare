import { realtimeTopics } from "@/lib/realtime-topics";

export const channels = {
  inboxMessages: realtimeTopics.inboxThreadMessages,
  inboxPresence: realtimeTopics.inboxThreadPresence,
};
