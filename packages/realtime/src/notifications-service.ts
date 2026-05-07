export function countUnread(messages: Array<{ readAt?: string | null; userId: string }>, viewerId: string) {
  return messages.filter((message) => message.userId !== viewerId && !message.readAt).length;
}
