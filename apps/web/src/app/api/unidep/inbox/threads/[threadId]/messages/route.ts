import { NextRequest, NextResponse } from "next/server";

import { getSessionUser } from "@/lib/authz";
import { isCloudflareRuntime } from "@/lib/cloudflare/runtime";
import {
  createD1InboxMessageForUser,
  listD1InboxMessagesForUser,
} from "@/lib/cloudflare/inbox";
import { broadcastInboxMessage } from "@/lib/supabase/server-realtime";

export async function GET(_request: NextRequest, context: { params: Promise<{ threadId: string }> }) {
  try {
    const session = await getSessionUser();
    if (session.status !== "ok" || !session.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { threadId } = await context.params;
    const payload = isCloudflareRuntime()
      ? await listD1InboxMessagesForUser(session.user.id, threadId)
      : await (await import("@/lib/inbox-service")).listInboxMessagesForUser(session.user.id, threadId);
    if (!payload) return NextResponse.json({ error: "No tienes acceso a este hilo." }, { status: 403 });
    return NextResponse.json({ success: true, messages: payload.messages });
  } catch (error) {
    console.error("Error fetching inbox messages:", error);
    return NextResponse.json({ error: "Failed to fetch inbox messages" }, { status: 503 });
  }
}

export async function POST(request: NextRequest, context: { params: Promise<{ threadId: string }> }) {
  try {
    const session = await getSessionUser();
    if (session.status !== "ok" || !session.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { threadId } = await context.params;
    let body: { content?: string };
    try {
      body = (await request.json()) as { content?: string };
    } catch {
      return NextResponse.json({ error: "invalid_json" }, { status: 400 });
    }
    const content = String(body.content ?? "").trim();
    if (!content) return NextResponse.json({ error: "content is required" }, { status: 400 });

    const message = isCloudflareRuntime()
      ? await createD1InboxMessageForUser({ actorUserId: session.user.id, threadId, content })
      : await (await import("@/lib/inbox-service")).createInboxMessageForUser({ actorUserId: session.user.id, threadId, content });

    try {
      await broadcastInboxMessage(threadId, message as unknown as Record<string, unknown>);
    } catch (broadcastError) {
      console.error("Inbox realtime broadcast failed:", broadcastError);
    }
    try {
      if (isCloudflareRuntime()) {
        return NextResponse.json({ success: true, message }, { status: 201 });
      }
      const { listInboxThreadRecipientUserIds } = await import("@/lib/inbox-service");
      const recipientUserIds = await listInboxThreadRecipientUserIds(
        threadId,
        session.user.id,
      );
      const { sendPushNotificationToUsers } = await import("@/lib/web-push");
      await sendPushNotificationToUsers(recipientUserIds, {
        title: message.sender.displayName,
        body: message.content,
        url: `/unidep/inbox/${threadId}`,
        tag: `inbox:${threadId}`,
        threadId,
      });
    } catch (pushError) {
      console.error("Inbox push notification failed:", pushError);
    }

    return NextResponse.json({ success: true, message }, { status: 201 });
  } catch (error) {
    console.error("Error creating inbox message:", error);
    return NextResponse.json({ error: "storage_unavailable" }, { status: 503 });
  }
}
