import { inboxRepository } from "@relead/domain/inbox/inbox-repository";
import { validateSendMessageInput } from "@relead/domain/inbox/schemas";
import { broadcastNewMessage } from "@relead/realtime/messaging-service";

export async function sendInternalMessage(input: {
  actorUserId: string;
  threadId: string;
  content: string;
}) {
  validateSendMessageInput(input);
  const message = await inboxRepository.sendMessage({
    actorUserId: input.actorUserId,
    threadId: input.threadId,
    content: input.content,
  });

  await broadcastNewMessage({
    id: message.id,
    threadId: message.threadId,
    userId: input.actorUserId,
    content: message.content,
    createdAt: message.createdAt,
  });

  return message;
}
