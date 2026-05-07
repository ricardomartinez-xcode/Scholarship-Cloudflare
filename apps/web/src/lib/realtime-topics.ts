export const realtimeTopics = {
  trainingRoomPresence(roomId: string) {
    return `training:room:${roomId}:presence`;
  },
  trainingChatMessages(chatId: string) {
    return `training:chat:${chatId}:messages`;
  },
  trainingChatPresence(chatId: string) {
    return `training:chat:${chatId}:presence`;
  },
  inboxThreadMessages(threadId: string) {
    return `inbox:thread:${threadId}:messages`;
  },
  inboxThreadPresence(threadId: string) {
    return `inbox:thread:${threadId}:presence`;
  },
};

export type RealtimeTopicDescriptor =
  | { kind: "training-room-presence"; roomId: string }
  | { kind: "training-chat-messages"; chatId: string }
  | { kind: "training-chat-presence"; chatId: string }
  | { kind: "inbox-thread-messages"; threadId: string }
  | { kind: "inbox-thread-presence"; threadId: string };

export function parseRealtimeTopic(topic: string): RealtimeTopicDescriptor | null {
  const trainingRoomPresence = /^training:room:([^:]+):presence$/;
  const trainingChatMessages = /^training:chat:([^:]+):messages$/;
  const trainingChatPresence = /^training:chat:([^:]+):presence$/;
  const inboxThreadMessages = /^inbox:thread:([^:]+):messages$/;
  const inboxThreadPresence = /^inbox:thread:([^:]+):presence$/;

  let match = topic.match(trainingRoomPresence);
  if (match) {
    return { kind: "training-room-presence", roomId: match[1] };
  }

  match = topic.match(trainingChatMessages);
  if (match) {
    return { kind: "training-chat-messages", chatId: match[1] };
  }

  match = topic.match(trainingChatPresence);
  if (match) {
    return { kind: "training-chat-presence", chatId: match[1] };
  }

  match = topic.match(inboxThreadMessages);
  if (match) {
    return { kind: "inbox-thread-messages", threadId: match[1] };
  }

  match = topic.match(inboxThreadPresence);
  if (match) {
    return { kind: "inbox-thread-presence", threadId: match[1] };
  }

  return null;
}
