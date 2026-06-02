import "server-only";

import { InboxThreadStatus } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { buildDisplayName } from "@/lib/training-access";

export type InboxParticipantIdentity = {
  userId: string;
  displayName: string;
  email: string;
};

export type InboxThreadSummary = {
  id: string;
  subject: string | null;
  status: InboxThreadStatus;
  organizationId: string | null;
  organizationName: string | null;
  createdAt: string;
  updatedAt: string;
  lastMessageAt: string | null;
  lastMessagePreview: string | null;
  lastMessageSender: InboxParticipantIdentity | null;
  participantCount: number;
  participants: InboxParticipantIdentity[];
};

export type InboxMessageSummary = {
  id: string;
  threadId: string;
  content: string;
  createdAt: string;
  sender: InboxParticipantIdentity;
};

function resolveUserDisplayName(input: { email: string; displayName?: string | null }) {
  return input.displayName?.trim() || buildDisplayName(input.email);
}

function serializeInboxIdentity(input: {
  userId?: string;
  id?: string;
  email: string;
  displayName?: string | null;
}) {
  return {
    userId: input.userId ?? input.id ?? "",
    email: input.email,
    displayName: resolveUserDisplayName(input),
  };
}

async function listInboxEligibleUsersForUser(userId: string) {
  const users = await prisma.user.findMany({
    where: {
      id: { not: userId },
      isActive: true,
    },
    orderBy: [{ displayName: "asc" }, { email: "asc" }],
    select: {
      id: true,
      email: true,
      displayName: true,
    },
  });

  return users.map((user) => serializeInboxIdentity(user));
}

export async function listInboxThreadsForUser(userId: string) {
  const threads = await prisma.inboxThread.findMany({
    where: {
      participants: {
        some: {
          userId,
        },
      },
    },
    orderBy: [{ lastMessageAt: "desc" }, { updatedAt: "desc" }],
    select: {
      id: true,
      subject: true,
      status: true,
      createdAt: true,
      updatedAt: true,
      lastMessageAt: true,
      organizationId: true,
      organization: {
        select: {
          displayName: true,
        },
      },
      participants: {
        orderBy: { joinedAt: "asc" },
        select: {
          user: {
            select: {
              id: true,
              email: true,
              displayName: true,
            },
          },
        },
      },
      messages: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: {
          content: true,
          createdAt: true,
          user: {
            select: {
              id: true,
              email: true,
              displayName: true,
            },
          },
        },
      },
      _count: {
        select: {
          participants: true,
        },
      },
    },
  });

  const eligibleUsers = await listInboxEligibleUsersForUser(userId);

  return {
    threads: threads.map((thread) => ({
      id: thread.id,
      subject: thread.subject,
      status: thread.status,
      organizationId: thread.organizationId,
      organizationName: thread.organization?.displayName ?? null,
      createdAt: thread.createdAt.toISOString(),
      updatedAt: thread.updatedAt.toISOString(),
      lastMessageAt: thread.lastMessageAt?.toISOString() ?? null,
      lastMessagePreview: thread.messages[0]?.content ?? null,
      lastMessageSender: thread.messages[0]?.user
        ? serializeInboxIdentity(thread.messages[0].user)
        : null,
      participantCount: thread._count.participants,
      participants: thread.participants.map((participant) =>
        serializeInboxIdentity(participant.user),
      ),
    })),
    eligibleUsers: eligibleUsers.sort((left, right) =>
      left.displayName.localeCompare(right.displayName),
    ),
  };
}

export async function getInboxThreadAccessForUser(userId: string, threadId: string) {
  const thread = await prisma.inboxThread.findUnique({
    where: { id: threadId },
    select: {
      id: true,
      subject: true,
      status: true,
      organizationId: true,
      participants: {
        where: { userId },
        select: {
          id: true,
        },
        take: 1,
      },
    },
  });

  if (!thread) {
    return null;
  }

  return {
    thread,
    participant: thread.participants[0] ?? null,
    canView: Boolean(thread.participants[0]),
    canSend: Boolean(thread.participants[0]) && thread.status === InboxThreadStatus.active,
  };
}

export async function createInboxThreadForUser(input: {
  actorUserId: string;
  recipientUserId: string;
  subject?: string | null;
}) {
  if (input.actorUserId === input.recipientUserId) {
    throw new Error("Selecciona un destinatario distinto.");
  }

  const recipient = await prisma.user.findFirst({
    where: {
      id: input.recipientUserId,
      isActive: true,
    },
    select: { id: true },
  });

  if (!recipient) {
    throw new Error("El usuario seleccionado no existe o está inactivo.");
  }

  const sharedOrganizations = await prisma.organizationMember.findMany({
    where: {
      userId: {
        in: [input.actorUserId, input.recipientUserId],
      },
    },
    select: {
      organizationId: true,
    },
  });

  const organizationCounts = new Map<string, number>();
  for (const membership of sharedOrganizations) {
    organizationCounts.set(
      membership.organizationId,
      (organizationCounts.get(membership.organizationId) ?? 0) + 1,
    );
  }

  const sharedOrganizationId =
    Array.from(organizationCounts.entries()).find(([, count]) => count > 1)?.[0] ?? null;

  const candidateThreads = await prisma.inboxThread.findMany({
    where: {
      OR: [
        ...(sharedOrganizationId ? [{ organizationId: sharedOrganizationId }] : []),
        { organizationId: null },
      ],
      participants: {
        some: {
          userId: {
            in: [input.actorUserId, input.recipientUserId],
          },
        },
      },
    },
    select: {
      id: true,
      participants: {
        select: {
          userId: true,
        },
      },
    },
  });

  const existing = candidateThreads.find((thread) => {
    const participantIds = thread.participants.map((participant) => participant.userId).sort();
    return (
      participantIds.length === 2 &&
      participantIds[0] !== participantIds[1] &&
      participantIds.includes(input.actorUserId) &&
      participantIds.includes(input.recipientUserId)
    );
  });

  if (existing) {
    return existing.id;
  }

  const thread = await prisma.inboxThread.create({
    data: {
      organizationId: sharedOrganizationId,
      subject: input.subject?.trim() || null,
      createdBy: input.actorUserId,
      participants: {
        create: [{ userId: input.actorUserId }, { userId: input.recipientUserId }],
      },
    },
    select: {
      id: true,
    },
  });

  return thread.id;
}

export async function listInboxMessagesForUser(userId: string, threadId: string) {
  const access = await getInboxThreadAccessForUser(userId, threadId);
  if (!access?.canView) {
    return null;
  }

  const messages = await prisma.inboxMessage.findMany({
    where: { threadId },
    orderBy: { createdAt: "asc" },
    take: 200,
    select: {
      id: true,
      threadId: true,
      content: true,
      createdAt: true,
      user: {
        select: {
          id: true,
          email: true,
          displayName: true,
        },
      },
    },
  });

  return {
    access,
    messages: messages.map((message) => ({
      id: message.id,
      threadId: message.threadId,
      content: message.content,
      createdAt: message.createdAt.toISOString(),
      sender: serializeInboxIdentity(message.user),
    })),
  };
}

export async function createInboxMessageForUser(input: {
  actorUserId: string;
  threadId: string;
  content: string;
}) {
  const access = await getInboxThreadAccessForUser(input.actorUserId, input.threadId);
  if (!access?.canSend) {
    throw new Error("No tienes permiso para enviar mensajes en este hilo.");
  }

  const now = new Date();
  const [message] = await prisma.$transaction([
    prisma.inboxMessage.create({
      data: {
        threadId: input.threadId,
        userId: input.actorUserId,
        content: input.content.trim(),
      },
      select: {
        id: true,
        threadId: true,
        content: true,
        createdAt: true,
        user: {
          select: {
            id: true,
            email: true,
            displayName: true,
          },
        },
      },
    }),
    prisma.inboxThread.update({
      where: { id: input.threadId },
      data: { lastMessageAt: now },
    }),
  ]);

  return {
    id: message.id,
    threadId: message.threadId,
    content: message.content,
    createdAt: message.createdAt.toISOString(),
    sender: serializeInboxIdentity(message.user),
  } satisfies InboxMessageSummary;
}

export async function authorizeInboxTopicForUser(userId: string, threadId: string) {
  const access = await getInboxThreadAccessForUser(userId, threadId);
  return Boolean(access?.canView);
}

export async function listInboxThreadRecipientUserIds(
  threadId: string,
  excludeUserId?: string,
) {
  const participants = await prisma.inboxThreadParticipant.findMany({
    where: {
      threadId,
      ...(excludeUserId
        ? {
            userId: {
              not: excludeUserId,
            },
          }
        : {}),
    },
    select: {
      userId: true,
    },
  });

  return participants.map((participant) => participant.userId);
}
