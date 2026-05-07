import { NextRequest, NextResponse } from "next/server";

import { getSessionUser } from "@/lib/authz";
import { authorizeInboxTopicForUser } from "@/lib/inbox-service";
import { createRealtimeAccessToken } from "@/lib/realtime-token";
import { parseRealtimeTopic } from "@/lib/realtime-topics";
import { authorizeTrainingTopicForUser } from "@/lib/training-rolplay";

type RequestBody = {
  topics?: string[];
};

export async function POST(request: NextRequest) {
  try {
    const session = await getSessionUser();
    if (session.status !== "ok" || !session.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await request.json()) as RequestBody;
    const topics = Array.from(
      new Set((body.topics ?? []).map((topic) => topic.trim()).filter(Boolean)),
    );

    if (topics.length === 0 || topics.length > 10) {
      return NextResponse.json(
        { error: "Debes solicitar entre 1 y 10 topics." },
        { status: 400 },
      );
    }

    for (const topic of topics) {
      const descriptor = parseRealtimeTopic(topic);
      if (!descriptor) {
        return NextResponse.json(
          { error: `Topic no permitido: ${topic}` },
          { status: 403 },
        );
      }

      switch (descriptor.kind) {
        case "training-room-presence": {
          const authorization = await authorizeTrainingTopicForUser(session.user.id, {
            kind: "room",
            roomId: descriptor.roomId,
          });
          if (!authorization.ok) {
            return NextResponse.json(
              { error: "No tienes acceso a la sala solicitada." },
              { status: 403 },
            );
          }
          break;
        }
        case "training-chat-messages":
        case "training-chat-presence": {
          const authorization = await authorizeTrainingTopicForUser(session.user.id, {
            kind: "chat",
            chatId: descriptor.chatId,
          });
          if (!authorization.ok) {
            return NextResponse.json(
              { error: "No tienes acceso al chat solicitado." },
              { status: 403 },
            );
          }
          break;
        }
        case "inbox-thread-messages":
        case "inbox-thread-presence": {
          const authorized = await authorizeInboxTopicForUser(
            session.user.id,
            descriptor.threadId,
          );
          if (!authorized) {
            return NextResponse.json(
              { error: "No tienes acceso al hilo solicitado." },
              { status: 403 },
            );
          }
          break;
        }
      }
    }

    const token = createRealtimeAccessToken({
      sub: session.user.id,
      email: session.user.email,
      topics,
    });

    return NextResponse.json({
      token,
      expiresInSeconds: 60 * 30,
    });
  } catch (error) {
    console.error("Failed to create realtime token:", error);
    return NextResponse.json(
      { error: "No se pudo autorizar la conexión realtime." },
      { status: 500 },
    );
  }
}
