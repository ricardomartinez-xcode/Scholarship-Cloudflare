import { NextRequest, NextResponse } from "next/server";

import { getSessionUser } from "@/lib/authz";
import { broadcastTrainingMessage } from "@/lib/supabase/server-realtime";
import {
  createTrainingMessageForUser,
  listTrainingMessagesForUser,
} from "@/lib/training-rolplay";

function readChatId(request: NextRequest, body?: Record<string, unknown>) {
  return String(
    request.nextUrl.searchParams.get("chatId") ?? body?.chatId ?? "",
  ).trim();
}

export async function GET(request: NextRequest) {
  try {
    const session = await getSessionUser();
    if (session.status !== "ok" || !session.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const chatId = readChatId(request);
    if (!chatId) {
      return NextResponse.json(
        { error: "chatId is required. roomId ya no es válido para rolplay." },
        { status: 400 },
      );
    }

    const payload = await listTrainingMessagesForUser(session.user.id, chatId);
    if (!payload) {
      return NextResponse.json(
        { error: "No tienes acceso a este chat." },
        { status: 403 },
      );
    }

    return NextResponse.json({
      success: true,
      messages: payload.messages,
    });
  } catch (error) {
    console.error("Error fetching messages:", error);
    return NextResponse.json(
      { error: "Failed to fetch messages" },
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

    const body = (await request.json()) as { chatId?: string; content?: string };
    const chatId = readChatId(request, body as Record<string, unknown>);
    const content = String(body.content ?? "").trim();

    if (!chatId || !content) {
      return NextResponse.json(
        { error: "chatId and content are required" },
        { status: 400 },
      );
    }

    const message = await createTrainingMessageForUser({
      actorUserId: session.user.id,
      chatId,
      content,
    });

    await broadcastTrainingMessage(chatId, message as unknown as Record<string, unknown>);

    return NextResponse.json(
      {
        success: true,
        message,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("Error creating message:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to create message",
      },
      { status: 500 },
    );
  }
}
