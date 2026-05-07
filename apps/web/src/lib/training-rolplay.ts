import "server-only";

import {
  TrainingAccessRole,
  TrainingChatStatus,
} from "@prisma/client";

import { prisma } from "@/lib/prisma";
import {
  buildDisplayName,
  ensureTrainingMembership,
  getTrainingRoomAccessForUser,
  type EffectiveTrainingRole,
} from "@/lib/training-access";

type IdentityInput = {
  userId: string;
  email: string;
  accessRole: TrainingAccessRole;
  anonymousAlias: string | null;
  isAnonymous: boolean;
};

export type TrainingIdentity = {
  userId: string;
  accessRole: TrainingAccessRole;
  displayName: string;
  alias: string | null;
  isAnonymous: boolean;
  realDisplayName: string | null;
  email: string | null;
};

export type TrainingRoomMemberSummary = TrainingIdentity & {
  membershipId: string;
  joinedAt: string;
};

export type TrainingChatSummary = {
  id: string;
  roomId: string;
  title: string | null;
  status: TrainingChatStatus;
  participantCount: number;
  messageCount: number;
  feedbackCount: number;
  createdAt: string;
  updatedAt: string;
  lastMessageAt: string | null;
  lastMessagePreview: string | null;
  participants: TrainingIdentity[];
};

export type TrainingMessageSummary = {
  id: string;
  roomId: string;
  chatId: string | null;
  content: string;
  createdAt: string;
  sender: TrainingIdentity;
};

export type TrainingFeedbackSummary = {
  id: string;
  chatId: string;
  roomId: string;
  rating: number | null;
  summary: string;
  strengths: string | null;
  improvements: string | null;
  createdAt: string;
  author: TrainingIdentity;
  target: TrainingIdentity;
};

function serializeTrainingIdentity(
  viewerRole: EffectiveTrainingRole,
  viewerId: string,
  input: IdentityInput,
): TrainingIdentity {
  const realDisplayName = buildDisplayName(input.email);
  const alias = input.anonymousAlias?.trim() || null;
  const shouldHideIdentity = input.isAnonymous && input.userId !== viewerId;

  return {
    userId: input.userId,
    accessRole: input.accessRole,
    displayName: shouldHideIdentity ? alias ?? "Participante anónimo" : realDisplayName,
    alias,
    isAnonymous: input.isAnonymous,
    realDisplayName: viewerRole === "user" ? null : realDisplayName,
    email: viewerRole === "user" ? null : input.email,
  };
}

function mapEffectiveRoleToAccessRole(role: EffectiveTrainingRole): TrainingAccessRole {
  switch (role) {
    case "owner":
      return TrainingAccessRole.owner;
    case "admin":
      return TrainingAccessRole.admin;
    case "moderator":
      return TrainingAccessRole.moderator;
    default:
      return TrainingAccessRole.user;
  }
}

export async function listTrainingRoomMembersForUser(userId: string, roomId: string) {
  const roomAccess = await getTrainingRoomAccessForUser(userId, roomId);
  if (!roomAccess || !roomAccess.canView) {
    return null;
  }

  const members = await prisma.trainingRoomMember.findMany({
    where: { roomId, leftAt: null },
    orderBy: [{ accessRole: "desc" }, { joinedAt: "asc" }],
    select: {
      id: true,
      accessRole: true,
      isAnonymous: true,
      anonymousAlias: true,
      joinedAt: true,
      user: {
        select: {
          id: true,
          email: true,
        },
      },
    },
  });

  const organizationMembers = roomAccess.capabilities.canManageMembers
    ? await prisma.organizationMember.findMany({
        where: { organizationId: roomAccess.room.organizationId },
        orderBy: { user: { email: "asc" } },
        select: {
          userId: true,
          user: {
            select: {
              id: true,
              email: true,
            },
          },
        },
      })
    : [];

  const activeMemberIds = new Set(members.map((member) => member.user.id));

  return {
    roomAccess,
    members: members.map((member) => ({
      membershipId: member.id,
      joinedAt: member.joinedAt.toISOString(),
      ...serializeTrainingIdentity(roomAccess.effectiveRole, userId, {
        userId: member.user.id,
        email: member.user.email,
        accessRole: member.accessRole,
        anonymousAlias: member.anonymousAlias,
        isAnonymous: member.isAnonymous,
      }),
    })),
    eligibleUsers: organizationMembers
      .filter((member) => !activeMemberIds.has(member.userId))
      .map((member) => ({
        userId: member.user.id,
        displayName: buildDisplayName(member.user.email),
        email: member.user.email,
      })),
  };
}

export async function upsertTrainingRoomMemberForUser(input: {
  actorUserId: string;
  roomId: string;
  targetUserId: string;
  accessRole: TrainingAccessRole;
  isAnonymous: boolean;
  anonymousAlias?: string | null;
  active?: boolean;
}) {
  const roomAccess = await getTrainingRoomAccessForUser(input.actorUserId, input.roomId);
  if (!roomAccess || !roomAccess.capabilities.canManageMembers) {
    throw new Error("No tienes permiso para gestionar acceso en esta sala.");
  }

  if (
    input.accessRole === TrainingAccessRole.owner &&
    roomAccess.effectiveRole !== "owner"
  ) {
    throw new Error("Solo owner puede asignar el rol owner.");
  }

  const isOrgMember = await prisma.organizationMember.findFirst({
    where: {
      organizationId: roomAccess.room.organizationId,
      userId: input.targetUserId,
    },
    select: { id: true },
  });

  if (!isOrgMember && roomAccess.effectiveRole === "user") {
    throw new Error("El usuario debe pertenecer a la organización de la sala.");
  }

  const existingMembership = await prisma.trainingRoomMember.findUnique({
    where: {
      roomId_userId: {
        roomId: input.roomId,
        userId: input.targetUserId,
      },
    },
  });

  if (input.active === false && existingMembership) {
    return prisma.trainingRoomMember.update({
      where: { id: existingMembership.id },
      data: { leftAt: new Date() },
    });
  }

  if (existingMembership) {
    return prisma.trainingRoomMember.update({
      where: { id: existingMembership.id },
      data: {
        leftAt: null,
        accessRole: input.accessRole,
        isAnonymous: input.isAnonymous,
        anonymousAlias: input.anonymousAlias?.trim() || existingMembership.anonymousAlias,
      },
    });
  }

  const currentMemberCount = await prisma.trainingRoomMember.count({
    where: { roomId: input.roomId },
  });

  return prisma.trainingRoomMember.create({
    data: {
      roomId: input.roomId,
      userId: input.targetUserId,
      accessRole: input.accessRole,
      isAnonymous: input.isAnonymous,
      anonymousAlias:
        input.anonymousAlias?.trim() ||
        `Participante ${String(currentMemberCount + 1).padStart(2, "0")}`,
    },
  });
}

export async function listTrainingChatsForUser(userId: string, roomId: string) {
  const roomAccess = await getTrainingRoomAccessForUser(userId, roomId);
  if (!roomAccess || !roomAccess.canView) {
    return null;
  }

  const chats = await prisma.trainingChat.findMany({
    where: {
      roomId,
      ...(roomAccess.capabilities.canManageChats
        ? {}
        : {
            participants: {
              some: {
                userId,
              },
            },
          }),
    },
    orderBy: [{ lastMessageAt: "desc" }, { updatedAt: "desc" }],
    select: {
      id: true,
      roomId: true,
      title: true,
      status: true,
      createdAt: true,
      updatedAt: true,
      lastMessageAt: true,
      participants: {
        orderBy: [{ role: "desc" }, { joinedAt: "asc" }],
        select: {
          role: true,
          user: {
            select: {
              id: true,
              email: true,
            },
          },
          roomMember: {
            select: {
              accessRole: true,
              isAnonymous: true,
              anonymousAlias: true,
            },
          },
        },
      },
      messages: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: {
          content: true,
        },
      },
      _count: {
        select: {
          participants: true,
          messages: true,
          feedbackEntries: true,
        },
      },
    },
  });

  return {
    roomAccess,
    chats: chats.map((chat) => ({
      id: chat.id,
      roomId: chat.roomId,
      title: chat.title,
      status: chat.status,
      participantCount: chat._count.participants,
      messageCount: chat._count.messages,
      feedbackCount: chat._count.feedbackEntries,
      createdAt: chat.createdAt.toISOString(),
      updatedAt: chat.updatedAt.toISOString(),
      lastMessageAt: chat.lastMessageAt?.toISOString() ?? null,
      lastMessagePreview: chat.messages[0]?.content ?? null,
      participants: chat.participants.map((participant) =>
        serializeTrainingIdentity(roomAccess.effectiveRole, userId, {
          userId: participant.user.id,
          email: participant.user.email,
          accessRole: participant.roomMember?.accessRole ?? participant.role,
          anonymousAlias: participant.roomMember?.anonymousAlias ?? null,
          isAnonymous: participant.roomMember?.isAnonymous ?? false,
        }),
      ),
    })),
  };
}

export async function createTrainingChatForUser(input: {
  actorUserId: string;
  roomId: string;
  participantUserIds: string[];
  title?: string | null;
  includeActor?: boolean;
}) {
  const roomAccess = await getTrainingRoomAccessForUser(input.actorUserId, input.roomId);
  if (!roomAccess || !roomAccess.capabilities.canManageChats) {
    throw new Error("No tienes permiso para crear chats en esta sala.");
  }

  const targetUserIds = Array.from(
    new Set(
      [
        ...input.participantUserIds.map((value) => value.trim()).filter(Boolean),
        ...(input.includeActor ? [input.actorUserId] : []),
      ].filter(Boolean),
    ),
  );

  if (targetUserIds.length < 2) {
    throw new Error("Selecciona al menos dos participantes para crear un chat.");
  }

  const orgMembers = await prisma.organizationMember.findMany({
    where: {
      organizationId: roomAccess.room.organizationId,
      userId: {
        in: targetUserIds,
      },
    },
    select: {
      userId: true,
    },
  });

  const allowedUserIds = new Set(orgMembers.map((member) => member.userId));
  if (
    roomAccess.effectiveRole === "user" &&
    targetUserIds.some((value) => !allowedUserIds.has(value))
  ) {
    throw new Error("Todos los participantes deben pertenecer a la organización.");
  }

  const memberships = await Promise.all(
    targetUserIds.map((participantUserId) =>
      ensureTrainingMembership(input.roomId, participantUserId),
    ),
  );

  const chat = await prisma.trainingChat.create({
    data: {
      roomId: input.roomId,
      title: input.title?.trim() || null,
      createdBy: input.actorUserId,
      participants: {
        create: memberships.map((membership) => ({
          userId: membership.userId,
          roomMemberId: membership.id,
          role:
            membership.userId === input.actorUserId
              ? mapEffectiveRoleToAccessRole(roomAccess.effectiveRole)
              : membership.accessRole,
        })),
      },
    },
    select: {
      id: true,
    },
  });

  return chat.id;
}

export async function closeTrainingChatForUser(actorUserId: string, chatId: string) {
  const chatAccess = await getTrainingChatAccessForUser(actorUserId, chatId);
  if (!chatAccess || !chatAccess.roomAccess.capabilities.canManageChats) {
    throw new Error("No tienes permiso para cerrar este chat.");
  }

  return prisma.trainingChat.update({
    where: { id: chatId },
    data: {
      status: TrainingChatStatus.closed,
      closedAt: new Date(),
    },
  });
}

export async function getTrainingChatAccessForUser(userId: string, chatId: string) {
  const chat = await prisma.trainingChat.findUnique({
    where: { id: chatId },
    select: {
      id: true,
      roomId: true,
      title: true,
      status: true,
      participants: {
        where: {
          userId,
        },
        select: {
          id: true,
          role: true,
          roomMemberId: true,
        },
        take: 1,
      },
    },
  });

  if (!chat) {
    return null;
  }

  const roomAccess = await getTrainingRoomAccessForUser(userId, chat.roomId);
  if (!roomAccess || !roomAccess.canView) {
    return null;
  }

  return {
    chat,
    roomAccess,
    participant: chat.participants[0] ?? null,
    canView:
      roomAccess.capabilities.canManageChats || Boolean(chat.participants[0]),
    canSend:
      chat.status === TrainingChatStatus.open &&
      (roomAccess.capabilities.canManageChats || Boolean(chat.participants[0])),
  };
}

export async function listTrainingMessagesForUser(userId: string, chatId: string) {
  const chatAccess = await getTrainingChatAccessForUser(userId, chatId);
  if (!chatAccess || !chatAccess.canView) {
    return null;
  }

  const messages = await prisma.trainingMessage.findMany({
    where: { chatId },
    orderBy: { createdAt: "asc" },
    take: 200,
    select: {
      id: true,
      roomId: true,
      chatId: true,
      content: true,
      createdAt: true,
      userId: true,
      user: {
        select: {
          email: true,
        },
      },
    },
  });

  const membershipRows = await prisma.trainingRoomMember.findMany({
    where: {
      roomId: chatAccess.chat.roomId,
      userId: {
        in: messages.map((message) => message.userId),
      },
    },
    select: {
      userId: true,
      accessRole: true,
      isAnonymous: true,
      anonymousAlias: true,
    },
  });

  const membershipByUserId = new Map(
    membershipRows.map((membership) => [membership.userId, membership]),
  );

  return {
    chatAccess,
    messages: messages.map((message) => {
      const membership = membershipByUserId.get(message.userId);
      return {
        id: message.id,
        roomId: message.roomId,
        chatId: message.chatId,
        content: message.content,
        createdAt: message.createdAt.toISOString(),
        sender: serializeTrainingIdentity(
          chatAccess.roomAccess.effectiveRole,
          userId,
          {
            userId: message.userId,
            email: message.user.email,
            accessRole: membership?.accessRole ?? TrainingAccessRole.user,
            anonymousAlias: membership?.anonymousAlias ?? null,
            isAnonymous: membership?.isAnonymous ?? false,
          },
        ),
      };
    }),
  };
}

export async function createTrainingMessageForUser(input: {
  actorUserId: string;
  chatId: string;
  content: string;
}) {
  const chatAccess = await getTrainingChatAccessForUser(input.actorUserId, input.chatId);
  if (!chatAccess || !chatAccess.canSend) {
    throw new Error("No tienes permiso para enviar mensajes en este chat.");
  }

  const senderMembership =
    chatAccess.roomAccess.membership ??
    (await ensureTrainingMembership(chatAccess.chat.roomId, input.actorUserId));

  if (!chatAccess.participant && chatAccess.roomAccess.capabilities.canManageChats) {
    await prisma.trainingChatParticipant.upsert({
      where: {
        chatId_userId: {
          chatId: input.chatId,
          userId: input.actorUserId,
        },
      },
      create: {
        chatId: input.chatId,
        userId: input.actorUserId,
        roomMemberId: senderMembership.id,
        role: mapEffectiveRoleToAccessRole(chatAccess.roomAccess.effectiveRole),
      },
      update: {
        roomMemberId: senderMembership.id,
      },
    });
  }

  const createdAt = new Date();

  const [message] = await prisma.$transaction([
    prisma.trainingMessage.create({
      data: {
        roomId: chatAccess.chat.roomId,
        chatId: input.chatId,
        userId: input.actorUserId,
        content: input.content.trim(),
      },
      select: {
        id: true,
        roomId: true,
        chatId: true,
        content: true,
        createdAt: true,
        userId: true,
        user: {
          select: {
            email: true,
          },
        },
      },
    }),
    prisma.trainingChat.update({
      where: { id: input.chatId },
      data: { lastMessageAt: createdAt },
    }),
  ]);

  return {
    id: message.id,
    roomId: message.roomId,
    chatId: message.chatId,
    content: message.content,
    createdAt: message.createdAt.toISOString(),
    sender: serializeTrainingIdentity(chatAccess.roomAccess.effectiveRole, input.actorUserId, {
      userId: message.userId,
      email: message.user.email,
      accessRole: senderMembership.accessRole,
      anonymousAlias: senderMembership.anonymousAlias,
      isAnonymous: senderMembership.isAnonymous,
    }),
  } satisfies TrainingMessageSummary;
}

export async function listTrainingFeedbackForUser(userId: string, chatId: string) {
  const chatAccess = await getTrainingChatAccessForUser(userId, chatId);
  if (!chatAccess || !chatAccess.canView) {
    return null;
  }

  const feedbackEntries = await prisma.trainingFeedback.findMany({
    where: { chatId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      chatId: true,
      roomId: true,
      rating: true,
      summary: true,
      strengths: true,
      improvements: true,
      createdAt: true,
      authorUser: {
        select: {
          id: true,
          email: true,
          trainingRoomMemberships: {
            where: {
              roomId: chatAccess.chat.roomId,
              leftAt: null,
            },
            select: {
              accessRole: true,
              isAnonymous: true,
              anonymousAlias: true,
            },
            take: 1,
          },
        },
      },
      targetUser: {
        select: {
          id: true,
          email: true,
          trainingRoomMemberships: {
            where: {
              roomId: chatAccess.chat.roomId,
              leftAt: null,
            },
            select: {
              accessRole: true,
              isAnonymous: true,
              anonymousAlias: true,
            },
            take: 1,
          },
        },
      },
    },
  });

  return feedbackEntries.map((entry) => ({
    id: entry.id,
    chatId: entry.chatId,
    roomId: entry.roomId,
    rating: entry.rating,
    summary: entry.summary,
    strengths: entry.strengths,
    improvements: entry.improvements,
    createdAt: entry.createdAt.toISOString(),
    author: serializeTrainingIdentity(chatAccess.roomAccess.effectiveRole, userId, {
      userId: entry.authorUser.id,
      email: entry.authorUser.email,
      accessRole:
        entry.authorUser.trainingRoomMemberships[0]?.accessRole ?? TrainingAccessRole.user,
      anonymousAlias: entry.authorUser.trainingRoomMemberships[0]?.anonymousAlias ?? null,
      isAnonymous: entry.authorUser.trainingRoomMemberships[0]?.isAnonymous ?? false,
    }),
    target: serializeTrainingIdentity(chatAccess.roomAccess.effectiveRole, userId, {
      userId: entry.targetUser.id,
      email: entry.targetUser.email,
      accessRole:
        entry.targetUser.trainingRoomMemberships[0]?.accessRole ?? TrainingAccessRole.user,
      anonymousAlias: entry.targetUser.trainingRoomMemberships[0]?.anonymousAlias ?? null,
      isAnonymous: entry.targetUser.trainingRoomMemberships[0]?.isAnonymous ?? false,
    }),
  })) satisfies TrainingFeedbackSummary[];
}

export async function createTrainingFeedbackForUser(input: {
  actorUserId: string;
  chatId: string;
  targetUserId: string;
  rating?: number | null;
  summary: string;
  strengths?: string | null;
  improvements?: string | null;
}) {
  const chatAccess = await getTrainingChatAccessForUser(input.actorUserId, input.chatId);
  if (!chatAccess || !chatAccess.roomAccess.capabilities.canEvaluate) {
    throw new Error("No tienes permiso para evaluar en este chat.");
  }

  const targetParticipant = await prisma.trainingChatParticipant.findUnique({
    where: {
      chatId_userId: {
        chatId: input.chatId,
        userId: input.targetUserId,
      },
    },
    select: { id: true },
  });

  if (!targetParticipant) {
    throw new Error("El usuario evaluado debe participar en el chat.");
  }

  return prisma.trainingFeedback.create({
    data: {
      roomId: chatAccess.chat.roomId,
      chatId: input.chatId,
      authorUserId: input.actorUserId,
      targetUserId: input.targetUserId,
      rating: input.rating ?? null,
      summary: input.summary.trim(),
      strengths: input.strengths?.trim() || null,
      improvements: input.improvements?.trim() || null,
    },
  });
}

export type TrainingChatRealtimeAuthorization =
  | { ok: false }
  | { ok: true; roomId: string };

export async function authorizeTrainingTopicForUser(
  userId: string,
  input:
    | { kind: "room"; roomId: string }
    | { kind: "chat"; chatId: string },
): Promise<TrainingChatRealtimeAuthorization> {
  if (input.kind === "room") {
    const roomAccess = await getTrainingRoomAccessForUser(userId, input.roomId);
    return roomAccess?.canView ? { ok: true, roomId: input.roomId } : { ok: false };
  }

  const chatAccess = await getTrainingChatAccessForUser(userId, input.chatId);
  if (!chatAccess || !chatAccess.canView) {
    return { ok: false };
  }

  return { ok: true, roomId: chatAccess.chat.roomId };
}
