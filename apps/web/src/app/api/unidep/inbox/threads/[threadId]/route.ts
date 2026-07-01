import { NextRequest, NextResponse } from "next/server";

import { getSessionUser } from "@/lib/authz";
import { isCloudflareRuntime } from "@/lib/cloudflare/runtime";
import {
  archiveD1InboxThreadForUser,
  deleteD1InboxThreadForUser,
  renameD1InboxThreadForUser,
} from "@/lib/cloudflare/inbox";
import {
  archiveInboxThreadForUser,
  deleteInboxThreadForUser,
  renameInboxThreadForUser,
} from "@/lib/inbox-service";

type RouteContext = { params: Promise<{ threadId: string }> };

async function requireViewer() {
  const session = await getSessionUser();
  if (session.status !== "ok" || !session.user?.id) return null;
  return session.user;
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const user = await requireViewer();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { threadId } = await context.params;
    const body = (await request.json()) as { subject?: string | null; status?: "active" | "archived" };
    let thread: { id: string; subject: string | null; status: string } | null = null;
    if (Object.prototype.hasOwnProperty.call(body, "subject")) {
      thread = isCloudflareRuntime()
        ? await renameD1InboxThreadForUser({ actorUserId: user.id, threadId, subject: body.subject ?? null })
        : await renameInboxThreadForUser({ actorUserId: user.id, threadId, subject: body.subject ?? null });
    }
    if (body.status === "archived") {
      thread = isCloudflareRuntime()
        ? await archiveD1InboxThreadForUser({ actorUserId: user.id, threadId })
        : await archiveInboxThreadForUser({ actorUserId: user.id, threadId });
    }
    if (!thread) return NextResponse.json({ error: "No changes requested" }, { status: 400 });
    return NextResponse.json({ success: true, thread });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to update inbox thread" }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  try {
    const user = await requireViewer();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { threadId } = await context.params;
    const thread = isCloudflareRuntime()
      ? await deleteD1InboxThreadForUser({ actorUserId: user.id, threadId })
      : await deleteInboxThreadForUser({ actorUserId: user.id, threadId });
    return NextResponse.json({ success: true, thread });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to delete inbox thread" }, { status: 500 });
  }
}
