import { NextRequest, NextResponse } from "next/server";

import { getSessionUser } from "@/lib/authz";
import { isCloudflareRuntime } from "@/lib/cloudflare/runtime";
import {
  archiveD1InboxThreadForUser,
  deleteD1InboxThreadForUser,
  renameD1InboxThreadForUser,
} from "@/lib/cloudflare/inbox";

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
    let body: { subject?: string | null; status?: "active" | "archived" };
    try {
      body = (await request.json()) as { subject?: string | null; status?: "active" | "archived" };
    } catch {
      return NextResponse.json({ error: "invalid_json" }, { status: 400 });
    }
    let thread: { id: string; subject: string | null; status: string } | null = null;
    if (Object.prototype.hasOwnProperty.call(body, "subject")) {
      thread = isCloudflareRuntime()
        ? await renameD1InboxThreadForUser({ actorUserId: user.id, threadId, subject: body.subject ?? null })
        : await (await import("@/lib/inbox-service")).renameInboxThreadForUser({ actorUserId: user.id, threadId, subject: body.subject ?? null });
    }
    if (body.status === "archived") {
      thread = isCloudflareRuntime()
        ? await archiveD1InboxThreadForUser({ actorUserId: user.id, threadId })
        : await (await import("@/lib/inbox-service")).archiveInboxThreadForUser({ actorUserId: user.id, threadId });
    }
    if (!thread) return NextResponse.json({ error: "No changes requested" }, { status: 400 });
    return NextResponse.json({ success: true, thread });
  } catch (error) {
    console.error("Error updating inbox thread:", error);
    return NextResponse.json({ error: "storage_unavailable" }, { status: 503 });
  }
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  try {
    const user = await requireViewer();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { threadId } = await context.params;
    const thread = isCloudflareRuntime()
      ? await deleteD1InboxThreadForUser({ actorUserId: user.id, threadId })
      : await (await import("@/lib/inbox-service")).deleteInboxThreadForUser({ actorUserId: user.id, threadId });
    return NextResponse.json({ success: true, thread });
  } catch (error) {
    console.error("Error deleting inbox thread:", error);
    return NextResponse.json({ error: "storage_unavailable" }, { status: 503 });
  }
}
