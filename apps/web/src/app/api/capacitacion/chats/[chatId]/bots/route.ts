import { TrainingAccessRole } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";

import { getSessionUser } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { ensureRoleplayBotUser } from "@/lib/roleplay-bot-participants";
import { getRoleplayBotConfig, type RoleplayBotId } from "@/lib/sales-roleplay-bots";

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
    const body = (await request.json()) as { botId?: RoleplayBotId };
    const botId = String(body.botId ?? "").trim() as RoleplayBotId;
    const bot = getRoleplayBotConfig(botId);

    const chat = await prisma.trainingChat.findFirst({
      where: {
        id: chatId,
        participants: { some: { userId: session.user.id } },
      },
      select: { id: true, roomId: true },
    });

    if (!chat) {
      return NextResponse.json({ error: "No tienes acceso a este chat." }, { status: 403 });
    }

    const botUser = await ensureRoleplayBotUser(botId, bot.name);

    await prisma.trainingChatParticipant.upsert({
      where: { chatId_userId: { chatId: chat.id, userId: botUser.id } },
      update: { role: TrainingAccessRole.user },
      create: {
        chatId: chat.id,
        userId: botUser.id,
        role: TrainingAccessRole.user,
      },
    });

    return NextResponse.json({
      success: true,
      participant: {
        userId: botUser.id,
        displayName: bot.name,
        email: botUser.email,
      },
    });
  } catch (error) {
    console.error("Error adding roleplay bot to chat:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to add roleplay bot" },
      { status: 500 },
    );
  }
}
