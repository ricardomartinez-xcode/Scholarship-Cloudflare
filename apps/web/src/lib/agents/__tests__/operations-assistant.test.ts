import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  prismaMock,
  getRateLimitStoreStateMock,
  getQuoteEngineStatusMock,
  writeAdminAuditLogMock,
  generateAiTextMock,
} = vi.hoisted(() => ({
  prismaMock: {
    adminImportSession: {
      findFirst: vi.fn(),
    },
    adminAuditLog: {
      findMany: vi.fn(),
    },
    programOffering: {
      count: vi.fn(),
    },
  },
  getRateLimitStoreStateMock: vi.fn(),
  getQuoteEngineStatusMock: vi.fn(),
  writeAdminAuditLogMock: vi.fn(),
  generateAiTextMock: vi.fn(),
}));

vi.mock("server-only", () => ({}));

vi.mock("@/lib/prisma", () => ({
  prisma: prismaMock,
}));

vi.mock("@/lib/rate-limit", () => ({
  getRateLimitStoreState: getRateLimitStoreStateMock,
}));

vi.mock("@/lib/admin-system-control", () => ({
  getQuoteEngineStatus: getQuoteEngineStatusMock,
}));

vi.mock("@/lib/admin-audit", () => ({
  writeAdminAuditLog: writeAdminAuditLogMock,
}));

vi.mock("@/lib/ai/client", () => ({
  generateAiText: generateAiTextMock,
}));

describe("operations assistant", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    getRateLimitStoreStateMock.mockReturnValue({
      sharedStoreConfigured: false,
      missing: ["UPSTASH_REDIS_REST_URL"],
      store: "memory",
    });
    getQuoteEngineStatusMock.mockResolvedValue({ ok: false, status: "no_active_offering" });
    prismaMock.adminImportSession.findFirst.mockResolvedValue({
      id: "import-1",
      status: "failed",
      module: "OFFER",
      fileName: "oferta.xlsx",
      errors: [{ row: 2 }],
      warnings: [],
      createdAt: new Date("2026-06-01T00:00:00.000Z"),
      updatedAt: new Date("2026-06-01T00:10:00.000Z"),
    });
    prismaMock.adminAuditLog.findMany.mockResolvedValue([]);
    prismaMock.programOffering.count.mockResolvedValue(0);
    generateAiTextMock.mockResolvedValue({
      ok: false,
      code: "ai_not_configured",
      error: "missing",
    });
  });

  it("prioritizes concrete process improvements from operations context", async () => {
    const {
      collectOperationsAssistantContext,
      recommendOperationsProcessImprovements,
    } = await import("@/lib/agents/operations-assistant");

    const context = await collectOperationsAssistantContext();
    const recommendations = recommendOperationsProcessImprovements(context);

    expect(recommendations.map((item) => item.id)).toEqual(
      expect.arrayContaining([
        "configure_shared_rate_limit",
        "stabilize_offer_imports",
        "restore_quote_engine_readiness",
      ]),
    );
  });

  it("requires explicit confirmation before writing an operational audit note", async () => {
    const { confirmOperationsAction } = await import(
      "@/lib/agents/operations-assistant"
    );

    await expect(
      confirmOperationsAction({
        actor: { id: "admin-1", email: "admin@example.com" },
        actionId: "create_audit_note",
        confirmationText: "ok",
        payload: { note: "Revisar importaciones" },
        requestId: "req-1",
      }),
    ).rejects.toThrow("CONFIRMAR");

    const result = await confirmOperationsAction({
      actor: { id: "admin-1", email: "admin@example.com" },
      actionId: "create_audit_note",
      confirmationText: "CONFIRMAR",
      payload: { note: "Revisar importaciones" },
      requestId: "req-2",
    });

    expect(result).toMatchObject({ confirmed: true, actionId: "create_audit_note" });
    expect(writeAdminAuditLogMock).toHaveBeenCalledWith(
      expect.objectContaining({
        entityType: "OperationsAssistantAction",
        message: "Revisar importaciones",
        requestId: "req-2",
      }),
    );
  });
});
