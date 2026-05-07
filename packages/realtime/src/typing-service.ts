import { channels } from "@relead/realtime/channels";

export function resolveTypingTopic(threadId: string) {
  return channels.inboxPresence(threadId);
}
