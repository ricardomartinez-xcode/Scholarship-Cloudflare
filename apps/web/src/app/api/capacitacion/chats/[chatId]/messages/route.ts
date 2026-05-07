import { NextRequest, NextResponse } from "next/server";

import { getSessionUser } from "@/lib/authz";
import { broadcastTrainingMessage } from "@/lib/supabase/server-realtime";
import {
  createTrainingMessageForUser,
  listTrainingMessagesForUser,
} from "@/lib/training-rolplay";

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ chatId: string }> },
) {
  try {
    const session = await getSessionUser();
    if (session.status !== "ok" || !session.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { chatId } = await context.params;
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
    console.error("Error fetching training messages:", error);
    return NextResponse.json(
      { error: "Failed to fetch messages" },
      { status: 500 },
    );
  }
}

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
    const body = (await request.json()) as { content?: string };
    const content = String(body.content ?? "").trim();

    if (!content) {
      return NextResponse.json({ error: "content is required" }, { status: 400 });
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
    console.error("Error creating training message:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to create message",
      },
      { status: 500 },
    );
  }
}
