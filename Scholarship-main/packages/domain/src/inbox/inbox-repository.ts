import {
  createInboxMessageForUser,
  createInboxThreadForUser,
  listInboxMessagesForUser,
  listInboxThreadsForUser,
} from "@/lib/inbox-service";

export const inboxRepository = {
  listThreads: listInboxThreadsForUser,
  listMessages: listInboxMessagesForUser,
  sendMessage: createInboxMessageForUser,
  createThread: createInboxThreadForUser,
};
