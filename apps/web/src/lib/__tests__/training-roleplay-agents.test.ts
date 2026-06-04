import { beforeEach, describe, expect, it, vi } from "vitest";

const { prismaMock, getTrainingChatAccessForUserMock, createTrainingMessageForUserMock } =
  vi.hoisted(() => ({
    prismaMock: {
      user: {
        upsert: vi.fn(),
      },
      trainingRoomMember: {
        upsert: vi.fn(),
      },
      trainingChatParticipant: {
        upsert: vi.fn(),
        deleteMany: vi.fn(),
      },
      trainingChat: {
        findUnique: vi.fn(),
      },
      trainingMessage: {
        findMany: vi.fn(),
      },
      trainingFeedback: {
        create: vi.fn(),
      },
    },
    getTrainingChatAccessForUserMock: vi.fn(),
    createTrainingMessageForUserMock: vi.fn(),
  }));

vi.mock("server-only", () => ({}));

vi.mock("@/lib/prisma", () => ({
  prisma: prismaMock,
}));

vi.mock("@/lib/training-rolplay", () => ({
  getTrainingChatAccessForUser: getTrainingChatAccessForUserMock,
  createTrainingMessageForUser: createTrainingMessageForUserMock,
}));

describe("training roleplay agents", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("exposes the five MVP agent modes", async () => {
    const { listRoleplayAgentDefinitions } = await import(
      "@/lib/training-roleplay-agents"
    );

    const agents = listRoleplayAgentDefinitions();

    expect(agents.map((agent) => agent.mode)).toEqual([
      "prospecto_indeciso",
      "prospecto_objecion_precio",
      "prospecto_comparando_escuelas",
      "coach_ventas",
      "evaluador",
    ]);
  });

  it("builds a bounded prompt without exposing internal control text", async () => {
    const { buildRoleplayAgentPrompt, ROLEPLAY_AGENT_DEFINITIONS } = await import(
      "@/lib/training-roleplay-agents"
    );

    const prompt = buildRoleplayAgentPrompt({
      definition: ROLEPLAY_AGENT_DEFINITIONS[1],
      scenario: "Licenciatura en línea con objeción por precio",
      difficulty: "dificil",
      roomScenario: "Venta consultiva",
      extraInstructions: "Presiona por becas, sin aceptar cierre inmediato.",
      messages: [
        { author: "Asesor", content: "Tenemos beca disponible." },
        { author: "Prospecto", content: "Estoy comparando opciones." },
      ],
    });

    expect(prompt).toContain("prospecto con objeción de precio");
    expect(prompt).toContain("No inventes precios");
    expect(prompt).not.toContain("OPENAI_API_KEY");
  });

  it("rejects adding an agent when the actor cannot manage chats", async () => {
    getTrainingChatAccessForUserMock.mockResolvedValue({
      roomAccess: { capabilities: { canManageChats: false } },
      chat: { roomId: "room-1" },
    });

    const { addRoleplayAgentToChat } = await import("@/lib/training-roleplay-agents");

    await expect(
      addRoleplayAgentToChat({
        actorUserId: "user-1",
        chatId: "chat-1",
        mode: "prospecto_indeciso",
        scenario: "Primer contacto",
        difficulty: "media",
      }),
    ).rejects.toThrow("No tienes permiso");
  });

  it("adds the internal agent as room member and chat participant", async () => {
    getTrainingChatAccessForUserMock.mockResolvedValue({
      roomAccess: { capabilities: { canManageChats: true } },
      chat: { roomId: "room-1" },
    });
    prismaMock.user.upsert.mockResolvedValue({
      id: "agent-user",
      email: "sales-roleplay-agent@system.recalc.local",
    });
    prismaMock.trainingRoomMember.upsert.mockResolvedValue({
      id: "member-1",
      userId: "agent-user",
    });
    prismaMock.trainingChatParticipant.upsert.mockResolvedValue({
      id: "participant-1",
    });

    const { addRoleplayAgentToChat } = await import("@/lib/training-roleplay-agents");

    const result = await addRoleplayAgentToChat({
      actorUserId: "admin-1",
      chatId: "chat-1",
      mode: "coach_ventas",
      scenario: "Seguimiento",
      difficulty: "basica",
    });

    expect(result).toMatchObject({
      userId: "agent-user",
      label: "Coach de ventas",
    });
    expect(prismaMock.trainingChatParticipant.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          chatId_userId: {
            chatId: "chat-1",
            userId: "agent-user",
          },
        },
      }),
    );
  });
});
