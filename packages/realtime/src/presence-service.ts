import { channels } from "@relead/realtime/channels";

export function resolvePresenceTopic(threadId: string) {
  return channels.inboxPresence(threadId);
}
