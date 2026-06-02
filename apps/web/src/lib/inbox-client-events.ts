export type InboxClientMessage = {
  id: string;
  threadId: string;
  content: string;
  createdAt: string;
  sender: {
    userId: string;
    displayName: string;
    email: string;
  };
};

export const INBOX_MESSAGE_CREATED_EVENT = "inbox:message-created";

export function dispatchInboxMessageCreated(message: InboxClientMessage) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent<InboxClientMessage>(INBOX_MESSAGE_CREATED_EVENT, {
      detail: message,
    }),
  );
}

export function parseInboxMessageCreatedEvent(event: Event) {
  const message = (event as CustomEvent<InboxClientMessage>).detail;
  if (!message?.id || !message.threadId || !message.content || !message.createdAt) {
    return null;
  }

  if (!message.sender?.userId) {
    return null;
  }

  return message;
}
