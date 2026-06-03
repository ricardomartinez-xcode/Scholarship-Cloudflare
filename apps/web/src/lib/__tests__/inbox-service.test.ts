import { beforeEach, describe, expect, it, vi } from "vitest";

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    user: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
    },
    inboxThread: {
      findMany: vi.fn(),
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    inboxMessage: {
      findMany: vi.fn(),
      create: vi.fn(),
    },
    inboxThreadParticipant: {
      findMany: vi.fn(),
    },
    organizationMember: {
      findMany: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: prismaMock,
}));

import {
  archiveInboxThreadForUser,
  createInboxThreadForUser,
  deleteInboxThreadForUser,
  listInboxThreadsForUser,
  renameInboxThreadForUser,
} from "@/lib/inbox-service";

describe("inbox-service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.user.findMany.mockResolvedValue([]);
    prismaMock.user.findFirst.mockResolvedValue({ id: "recipient" });
    prismaMock.inboxThread.findMany.mockResolvedValue([]);
    prismaMock.inboxThread.create.mockResolvedValue({ id: "thread-direct" });
    prismaMock.organizationMember.findMany.mockResolvedValue([]);
  });

  it("lists every active non-viewer user as an eligible inbox recipient", async () => {
    prismaMock.user.findMany.mockResolvedValue([
      {
        id: "user-2",
        email: "ana@example.com",
        displayName: "Ana Lopez",
      },
      {
        id: "user-3",
        email: "brenda@example.com",
        displayName: "Brenda Ruiz",
      },
    ]);

    const payload = await listInboxThreadsForUser("user-1");

    expect(prismaMock.inboxThread.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          participants: {
            some: {
              userId: "user-1",
            },
          },
        },
      }),
    );
    expect(prismaMock.user.findMany).toHaveBeenCalledWith({
      where: {
        id: { not: "user-1" },
        isActive: true,
      },
      orderBy: [{ displayName: "asc" }, { email: "asc" }],
      select: {
        id: true,
        email: true,
        displayName: true,
      },
    });
    expect(prismaMock.organizationMember.findMany).not.toHaveBeenCalled();
    expect(payload.eligibleUsers).toEqual([
      {
        userId: "user-2",
        email: "ana@example.com",
        displayName: "Ana Lopez",
      },
      {
        userId: "user-3",
        email: "brenda@example.com",
        displayName: "Brenda Ruiz",
      },
    ]);
  });

  it("creates a direct inbox thread when users do not share an organization", async () => {
    const threadId = await createInboxThreadForUser({
      actorUserId: "user-1",
      recipientUserId: "user-2",
    });

    expect(threadId).toBe("thread-direct");
    expect(prismaMock.inboxThread.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: [{ organizationId: null }],
        }),
      }),
    );
    expect(prismaMock.inboxThread.create).toHaveBeenCalledWith({
      data: {
        organizationId: null,
        subject: null,
        createdBy: "user-1",
        participants: {
          create: [{ userId: "user-1" }, { userId: "user-2" }],
        },
      },
      select: {
        id: true,
      },
    });
  });

  it("reuses an existing direct two-person thread", async () => {
    prismaMock.inboxThread.findMany.mockResolvedValue([
      {
        id: "existing-thread",
        participants: [{ userId: "user-2" }, { userId: "user-1" }],
      },
    ]);

    const threadId = await createInboxThreadForUser({
      actorUserId: "user-1",
      recipientUserId: "user-2",
    });

    expect(threadId).toBe("existing-thread");
    expect(prismaMock.inboxThread.create).not.toHaveBeenCalled();
  });

  it("rejects inactive or missing recipients", async () => {
    prismaMock.user.findFirst.mockResolvedValue(null);

    await expect(
      createInboxThreadForUser({
        actorUserId: "user-1",
        recipientUserId: "user-2",
      }),
    ).rejects.toThrow("inactivo");
    expect(prismaMock.inboxThread.create).not.toHaveBeenCalled();
  });

  it("renames a thread when the actor is a participant", async () => {
    prismaMock.inboxThread.findUnique.mockResolvedValue({
      id: "thread-1",
      subject: null,
      status: "active",
      organizationId: null,
      participants: [{ id: "participant-1" }],
    });
    prismaMock.inboxThread.update.mockResolvedValue({
      id: "thread-1",
      subject: "Seguimiento beca",
      status: "active",
    });

    const thread = await renameInboxThreadForUser({
      actorUserId: "user-1",
      threadId: "thread-1",
      subject: "Seguimiento beca",
    });

    expect(prismaMock.inboxThread.update).toHaveBeenCalledWith({
      where: { id: "thread-1" },
      data: { subject: "Seguimiento beca" },
      select: { id: true, subject: true, status: true },
    });
    expect(thread.subject).toBe("Seguimiento beca");
  });

  it("archives a thread when the actor is a participant", async () => {
    prismaMock.inboxThread.findUnique.mockResolvedValue({
      id: "thread-1",
      subject: "Seguimiento",
      status: "active",
      organizationId: null,
      participants: [{ id: "participant-1" }],
    });
    prismaMock.inboxThread.update.mockResolvedValue({
      id: "thread-1",
      subject: "Seguimiento",
      status: "archived",
    });

    const thread = await archiveInboxThreadForUser({
      actorUserId: "user-1",
      threadId: "thread-1",
    });

    expect(prismaMock.inboxThread.update).toHaveBeenCalledWith({
      where: { id: "thread-1" },
      data: { status: "archived" },
      select: { id: true, subject: true, status: true },
    });
    expect(thread.status).toBe("archived");
  });

  it("deletes a thread when the actor is a participant", async () => {
    prismaMock.inboxThread.findUnique.mockResolvedValue({
      id: "thread-1",
      subject: "Seguimiento",
      status: "active",
      organizationId: null,
      participants: [{ id: "participant-1" }],
    });
    prismaMock.inboxThread.delete.mockResolvedValue({ id: "thread-1" });

    const thread = await deleteInboxThreadForUser({
      actorUserId: "user-1",
      threadId: "thread-1",
    });

    expect(prismaMock.inboxThread.delete).toHaveBeenCalledWith({
      where: { id: "thread-1" },
      select: { id: true },
    });
    expect(thread.id).toBe("thread-1");
  });
});
