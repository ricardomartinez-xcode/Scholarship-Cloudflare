import { describe, expect, it } from "vitest";

import { resolveExpectedCampaignStatusForRepair } from "@/services/extensionCampaignRepairService";

describe("resolveExpectedCampaignStatusForRepair", () => {
  const now = new Date("2026-01-01T12:00:00.000Z");

  it("mueve waiting_runner a queued cuando runner está activo y hay destinatarios listos", () => {
    const result = resolveExpectedCampaignStatusForRepair({
      currentStatus: "waiting_runner",
      channel: "extension_runner",
      scheduleAt: null,
      pendingRecipients: 5,
      readyRecipients: 5,
      claimedRecipients: 0,
      totalRecipients: 5,
      sentRecipients: 0,
      failedRecipients: 0,
      runnerAvailable: true,
      now,
    });

    expect(result).toBe("queued");
  });

  it("mantiene processing cuando hay recipients claimed activos", () => {
    const result = resolveExpectedCampaignStatusForRepair({
      currentStatus: "processing",
      channel: "extension_runner",
      scheduleAt: null,
      pendingRecipients: 8,
      readyRecipients: 3,
      claimedRecipients: 2,
      totalRecipients: 10,
      sentRecipients: 0,
      failedRecipients: 0,
      runnerAvailable: false,
      now,
    });

    expect(result).toBe("processing");
  });

  it("resuelve estado terminal partial cuando termina con mezcla de enviados y fallidos", () => {
    const result = resolveExpectedCampaignStatusForRepair({
      currentStatus: "processing",
      channel: "extension_runner",
      scheduleAt: null,
      pendingRecipients: 0,
      readyRecipients: 0,
      claimedRecipients: 0,
      totalRecipients: 10,
      sentRecipients: 7,
      failedRecipients: 3,
      runnerAvailable: true,
      now,
    });

    expect(result).toBe("partial");
  });
});

