import { NextRequest, NextResponse } from "next/server";

import { getSessionUser } from "@/lib/authz";
import {
  closeTrainingChatForUser,
  createTrainingChatForUser,
  listTrainingChatsForUser,
} from "@/lib/training-rolplay";

export async function GET(request: NextRequest) {
  try {
    const session = await getSessionUser();
    if (session.status !== "ok" || !session.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const roomId = request.nextUrl.searchParams.get("roomId");
    if (!roomId) {
      return NextResponse.json({ error: "roomId is required" }, { status: 400 });
    }

    const payload = await listTrainingChatsForUser(session.user.id, roomId);
    if (!payload) {
      return NextResponse.json(
        { error: "No tienes acceso a esta sala." },
        { status: 403 },
      );
    }

    return NextResponse.json({
      success: true,
      roomAccess: {
        effectiveRole: payload.roomAccess.effectiveRole,
        capabilities: payload.roomAccess.capabilities,
      },
      chats: payload.chats,
    });
  } catch (error) {
    console.error("Error fetching chats:", error);
    return NextResponse.json(
      { error: "Failed to fetch chats" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSessionUser();
    if (session.status !== "ok" || !session.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await request.json()) as {
      roomId?: string;
      participantUserIds?: string[];
      title?: string | null;
      includeActor?: boolean;
    };

    const roomId = String(body.roomId ?? "").trim();
    const participantUserIds = Array.isArray(body.participantUserIds)
      ? body.participantUserIds
      : [];

    if (!roomId || participantUserIds.length === 0) {
      return NextResponse.json(
        { error: "roomId and participantUserIds are required" },
        { status: 400 },
      );
    }

    const chatId = await createTrainingChatForUser({
      actorUserId: session.user.id,
      roomId,
      participantUserIds,
      title: body.title ?? null,
      includeActor: body.includeActor ?? false,
    });

    return NextResponse.json(
      {
        success: true,
        chatId,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("Error creating chat:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to create chat",
      },
      { status: 500 },
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await getSessionUser();
    if (session.status !== "ok" || !session.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await request.json()) as {
      chatId?: string;
      action?: "close";
    };

    const chatId = String(body.chatId ?? "").trim();
    if (!chatId || body.action !== "close") {
      return NextResponse.json(
        { error: "chatId and action=close are required" },
        { status: 400 },
      );
    }

    await closeTrainingChatForUser(session.user.id, chatId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error updating chat:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to update chat",
      },
      { status: 500 },
    );
  }
}
