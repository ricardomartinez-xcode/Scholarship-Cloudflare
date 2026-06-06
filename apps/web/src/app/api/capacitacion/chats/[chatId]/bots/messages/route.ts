import { TrainingAccessRole } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";

import { getSessionUser } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { ensureRoleplayBotUser } from "@/lib/roleplay-bot-participants";
import { getRoleplayBotReply, type RoleplayBotId } from "@/lib/sales-roleplay-bots";
import { broadcastTrainingMessage } from "@/lib/supabase/server-realtime";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ chatId: string }> },
) {
  try {
    const session = await getSessionUser();
    if (session.status !== "ok" || !session.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { chatId } = await context.params;
    const body = (await request.json()) as {
      botId?: RoleplayBotId;
      advisorMessage?: string;
      extraKnowledge?: string;
    };
    const botId = String(body.botId ?? "").trim() as RoleplayBotId;
    const advisorMessage = String(body.advisorMessage ?? "").trim();

    if (!advisorMessage) {
      return NextResponse.json({ error: "advisorMessage is required" }, { status: 400 });
    }

    const chat = await prisma.trainingChat.findFirst({
      where: {
        id: chatId,
        status: "open",
        participants: { some: { userId: session.user.id } },
      },
      select: {
        id: true,
        roomId: true,
        room: { select: { scenario: true, description: true } },
        _count: { select: { messages: true } },
      },
    });

    if (!chat) {
      return NextResponse.json({ error: "No tienes acceso a este chat abierto." }, { status: 403 });
    }

    const reply = getRoleplayBotReply({
      botId,
      advisorMessage,
      scenario: chat.room.scenario ?? chat.room.description ?? "",
      extraKnowledge: body.extraKnowledge ?? "",
      turnIndex: chat._count.messages,
    });
    const botUser = await ensureRoleplayBotUser(reply.botId, reply.botName);

    await prisma.trainingChatParticipant.upsert({
      where: { chatId_userId: { chatId: chat.id, userId: botUser.id } },
      update: { role: TrainingAccessRole.user },
      create: {
        chatId: chat.id,
        userId: botUser.id,
        role: TrainingAccessRole.user,
      },
    });

    const message = await prisma.trainingMessage.create({
      data: {
        roomId: chat.roomId,
        chatId: chat.id,
        userId: botUser.id,
        content: reply.text,
      },
      include: {
        user: {
          select: {
            id: true,
            displayName: true,
            email: true,
          },
        },
      },
    });

    await prisma.trainingChat.update({
      where: { id: chat.id },
      data: { lastMessageAt: message.createdAt },
    });

    const payload = {
      id: message.id,
      content: message.content,
      createdAt: message.createdAt.toISOString(),
      sender: {
        userId: botUser.id,
        accessRole: "user" as const,
        displayName: reply.botName,
        alias: null,
        isAnonymous: false,
        realDisplayName: message.user.displayName,
        email: message.user.email,
      },
    };

    await broadcastTrainingMessage(chat.id, payload as unknown as Record<string, unknown>);

    return NextResponse.json({ success: true, reply, message: payload }, { status: 201 });
  } catch (error) {
    console.error("Error creating roleplay bot message:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create roleplay bot message" },
      { status: 500 },
    );
  }
}
