import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  extensionCampaignFindManyMock,
  extensionCampaignFindUniqueMock,
  extensionCampaignUpdateMock,
  extensionCampaignRecipientUpdateManyMock,
  transactionMock,
  writeAdminAuditLogMock,
  logStructuredMock,
} = vi.hoisted(() => ({
  extensionCampaignFindManyMock: vi.fn(),
  extensionCampaignFindUniqueMock: vi.fn(),
  extensionCampaignUpdateMock: vi.fn(),
  extensionCampaignRecipientUpdateManyMock: vi.fn(),
  transactionMock: vi.fn(),
  writeAdminAuditLogMock: vi.fn(),
  logStructuredMock: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    extensionCampaign: {
      findMany: extensionCampaignFindManyMock,
      findUnique: extensionCampaignFindUniqueMock,
      update: extensionCampaignUpdateMock,
    },
    extensionCampaignRecipient: {
      updateMany: extensionCampaignRecipientUpdateManyMock,
    },
    $transaction: transactionMock,
  },
}));

vi.mock("@/lib/admin-audit", () => ({
  writeAdminAuditLog: writeAdminAuditLogMock,
}));

vi.mock("@/lib/observability", () => ({
  logStructured: logStructuredMock,
}));

vi.mock("@/services/authSyncService", () => ({
  getAuthSyncDiagnostics: vi.fn(),
}));

import { executeRepairAction, previewRepairAction } from "@/services/repairActionsService";

function buildStuckCandidate(status = "processing") {
  return {
    id: "camp_1",
    campaignName: "Campaña 1",
    status,
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    recipients: [{ id: "rec_1" }],
  };
}

describe("repairActionsService campaigns.reset_stuck_processing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    extensionCampaignFindManyMock.mockResolvedValue([]);
    extensionCampaignFindUniqueMock.mockResolvedValue(null);
    extensionCampaignUpdateMock.mockResolvedValue({ count: 1 });
    extensionCampaignRecipientUpdateManyMock.mockResolvedValue({ count: 1 });
    transactionMock.mockImplementation(async (operations: unknown[]) => Promise.all(operations));
    writeAdminAuditLogMock.mockResolvedValue(undefined);
  });

  it("consulta candidatos usando estados runtime actuales más running legacy", async () => {
    await previewRepairAction({
      actionId: "campaigns.reset_stuck_processing",
      previewLimit: 10,
    });

    const query = extensionCampaignFindManyMock.mock.calls[0]?.[0] as {
      where: { status: { in: string[] } };
    };
    expect(query.where.status.in).toEqual([
      "queued",
      "scheduled",
      "running",
      "processing",
      "waiting_runner",
    ]);
  });

  it("al aplicar, deja la campaña en scheduled cuando todos los claimed siguen programados", async () => {
    extensionCampaignFindManyMock.mockResolvedValue([buildStuckCandidate("scheduled")]);
    extensionCampaignFindUniqueMock.mockResolvedValue({
      id: "camp_1",
      recipients: [{ id: "rec_1", scheduledFor: new Date("2099-01-01T00:00:00.000Z") }],
    });

    const result = await executeRepairAction({
      actionId: "campaigns.reset_stuck_processing",
      actor: { id: "admin_1", email: "admin@example.com" },
      requestId: "req_legacy_repair_scheduled",
    });

    expect(extensionCampaignUpdateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "camp_1" },
        data: { status: "scheduled", completedAt: null },
      }),
    );
    expect(result.appliedCount).toBe(1);
  });

  it("al aplicar, deja la campaña en queued cuando hay claimed listos para reintento inmediato", async () => {
    extensionCampaignFindManyMock.mockResolvedValue([buildStuckCandidate("waiting_runner")]);
    extensionCampaignFindUniqueMock.mockResolvedValue({
      id: "camp_1",
      recipients: [
        { id: "rec_now", scheduledFor: null },
        { id: "rec_future", scheduledFor: new Date("2099-01-01T00:00:00.000Z") },
      ],
    });

    const result = await executeRepairAction({
      actionId: "campaigns.reset_stuck_processing",
      actor: { id: "admin_1", email: "admin@example.com" },
      requestId: "req_legacy_repair_queued",
    });

    expect(extensionCampaignUpdateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "camp_1" },
        data: { status: "queued", completedAt: null },
      }),
    );
    expect(extensionCampaignRecipientUpdateManyMock).toHaveBeenCalledTimes(2);
    expect(result.appliedCount).toBe(1);
  });
});
