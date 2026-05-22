import { inboxRepository } from "@relead/domain/inbox/inbox-repository";

export async function getInboxConversationsForUser(userId: string) {
  return inboxRepository.listThreads(userId);
}
