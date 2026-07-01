import { NextRequest, NextResponse } from "next/server";

import { getSessionUser } from "@/lib/authz";
import { isCloudflareRuntime } from "@/lib/cloudflare/runtime";
import {
  createD1InboxThreadForUser,
  listD1InboxThreadsForUser,
} from "@/lib/cloudflare/inbox";
import {
  createInboxThreadForUser,
  listInboxThreadsForUser,
} from "@/lib/inbox-service";

export async function GET() {
  try {
    const session = await getSessionUser();
    if (session.status !== "ok" || !session.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const payload = isCloudflareRuntime()
      ? await listD1InboxThreadsForUser(session.user.id)
      : await listInboxThreadsForUser(session.user.id);
    return NextResponse.json({
      success: true,
      viewer: {
        userId: session.user.id,
        email: session.user.email,
        displayName: session.user.displayName?.trim() || session.user.email,
      },
      threads: payload.threads,
      eligibleUsers: payload.eligibleUsers,
    });
  } catch (error) {
    console.error("Error fetching inbox threads:", error);
    return NextResponse.json({ error: "Failed to fetch inbox threads" }, { status: 503 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSessionUser();
    if (session.status !== "ok" || !session.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await request.json()) as { recipientUserId?: string; subject?: string | null };
    const recipientUserId = String(body.recipientUserId ?? "").trim();
    if (!recipientUserId) {
      return NextResponse.json({ error: "recipientUserId is required" }, { status: 400 });
    }

    const threadId = isCloudflareRuntime()
      ? await createD1InboxThreadForUser({ actorUserId: session.user.id, recipientUserId, subject: body.subject ?? null })
      : await createInboxThreadForUser({ actorUserId: session.user.id, recipientUserId, subject: body.subject ?? null });

    return NextResponse.json({ success: true, threadId }, { status: 201 });
  } catch (error) {
    console.error("Error creating inbox thread:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create inbox thread" },
      { status: 500 },
    );
  }
}
