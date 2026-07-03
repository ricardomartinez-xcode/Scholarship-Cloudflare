import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const {
  broadcastInboxMessageMock,
  createD1InboxMessageForUserMock,
  getSessionUserMock,
  isCloudflareRuntimeMock,
  listD1InboxThreadRecipientUserIdsMock,
  sendPushNotificationToUsersMock,
} = vi.hoisted(() => ({
  broadcastInboxMessageMock: vi.fn(),
  createD1InboxMessageForUserMock: vi.fn(),
  getSessionUserMock: vi.fn(),
  isCloudflareRuntimeMock: vi.fn(),
  listD1InboxThreadRecipientUserIdsMock: vi.fn(),
  sendPushNotificationToUsersMock: vi.fn(),
}));

vi.mock("@/lib/authz", () => ({
  getSessionUser: getSessionUserMock,
}));

vi.mock("@/lib/cloudflare/runtime", () => ({
  isCloudflareRuntime: isCloudflareRuntimeMock,
}));

vi.mock("@/lib/cloudflare/inbox", () => ({
  createD1InboxMessageForUser: createD1InboxMessageForUserMock,
  listD1InboxMessagesForUser: vi.fn(),
  listD1InboxThreadRecipientUserIds: listD1InboxThreadRecipientUserIdsMock,
}));

vi.mock("@/lib/inbox-service", () => ({
  createInboxMessageForUser: vi.fn(),
  listInboxMessagesForUser: vi.fn(),
  listInboxThreadRecipientUserIds: vi.fn(),
}));

vi.mock("@/lib/supabase/server-realtime", () => ({
  broadcastInboxMessage: broadcastInboxMessageMock,
}));

vi.mock("@/lib/web-push", () => ({
  sendPushNotificationToUsers: sendPushNotificationToUsersMock,
}));

import { POST } from "./route";

describe("POST /api/unidep/inbox/threads/[threadId]/messages", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isCloudflareRuntimeMock.mockReturnValue(true);
    getSessionUserMock.mockResolvedValue({
      status: "ok",
      user: { id: "user-1", email: "user@example.com" },
    });
    createD1InboxMessageForUserMock.mockResolvedValue({
      id: "message-1",
      threadId: "thread-1",
      content: "Hola",
      createdAt: "2026-07-03T00:00:00.000Z",
      sender: { userId: "user-1", email: "user@example.com", displayName: "User" },
    });
    listD1InboxThreadRecipientUserIdsMock.mockResolvedValue(["user-2"]);
  });

  it("does not call Prisma-backed push notifications in Cloudflare runtime", async () => {
    const response = await POST(
      new NextRequest(
        "https://recalc.test/api/unidep/inbox/threads/thread-1/messages",
        {
          method: "POST",
          body: JSON.stringify({ content: "Hola" }),
        },
      ),
      { params: Promise.resolve({ threadId: "thread-1" }) },
    );

    expect(response.status).toBe(201);
    expect(createD1InboxMessageForUserMock).toHaveBeenCalledWith({
      actorUserId: "user-1",
      threadId: "thread-1",
      content: "Hola",
    });
    expect(broadcastInboxMessageMock).toHaveBeenCalled();
    expect(listD1InboxThreadRecipientUserIdsMock).not.toHaveBeenCalled();
    expect(sendPushNotificationToUsersMock).not.toHaveBeenCalled();
  });
});
