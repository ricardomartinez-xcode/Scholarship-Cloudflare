import { describe, expect, it } from "vitest";

import {
  campaignHasCompletedIssues,
  campaignStatusDisplayLabel,
  campaignStatusTone,
} from "../WebCampaignsPanel";

type CampaignForStatus = Parameters<typeof campaignStatusDisplayLabel>[0];

function buildCampaign(overrides: Partial<CampaignForStatus> = {}): CampaignForStatus {
  return {
    status: "sent",
    businessStatus: "completed",
    businessStatusLabel: "Completada",
    stats: {
      total: 1,
      failed: 0,
    },
    recipients: [],
    ...overrides,
  };
}

function failedRecipient(
  id: string,
): NonNullable<CampaignForStatus["recipients"]>[number] {
  return {
    id,
    contactValue: "525500000000",
    contactName: "Contacto",
    status: "failed",
    resolvedMessage: "",
    scheduledFor: null,
    attemptedAt: null,
    sentAt: null,
    lastError: "No entregado",
  };
}

describe("WebCampaignsPanel status helpers", () => {
  it("presenta campañas failed como completadas con incidencias", () => {
    const campaign = buildCampaign({
      status: "failed",
      businessStatus: "failed",
      businessStatusLabel: "Fallida",
      stats: {
        total: 1,
        failed: 1,
      },
      recipients: [failedRecipient("rec_1")],
    });

    expect(campaignHasCompletedIssues(campaign)).toBe(true);
    expect(campaignStatusTone(campaign)).toContain("border-cyan");
    expect(campaignStatusDisplayLabel(campaign)).toBe(
      "Completada con incidencias (1 fallido(s))",
    );
  });

  it("mantiene campañas sent sin fallidos como completadas", () => {
    const campaign = buildCampaign({
      status: "sent",
      businessStatus: "completed",
      businessStatusLabel: "Completada",
      stats: {
        total: 3,
        failed: 0,
      },
    });

    expect(campaignHasCompletedIssues(campaign)).toBe(false);
    expect(campaignStatusTone(campaign)).toContain("border-emerald");
    expect(campaignStatusDisplayLabel(campaign)).toBe("Completada");
  });

  it("muestra sent con fallidos como completada con incidencias y conteo correcto", () => {
    const campaign = buildCampaign({
      status: "sent",
      businessStatus: "completed",
      businessStatusLabel: "Completada",
      stats: {
        total: 3,
        failed: 2,
      },
      recipients: [failedRecipient("rec_3"), failedRecipient("rec_4")],
    });

    expect(campaignHasCompletedIssues(campaign)).toBe(true);
    expect(campaignStatusTone(campaign)).toContain("border-cyan");
    expect(campaignStatusDisplayLabel(campaign)).toBe(
      "Completada con incidencias (2 fallido(s))",
    );
  });

  it("no marca campañas en ejecución como completadas con incidencias", () => {
    const campaign = buildCampaign({
      status: "running",
      businessStatus: "processing",
      businessStatusLabel: "Procesando",
      stats: {
        total: 2,
        failed: 1,
      },
      recipients: [failedRecipient("rec_2")],
    });

    expect(campaignHasCompletedIssues(campaign)).toBe(false);
    expect(campaignStatusTone(campaign)).toContain("border-sky");
    expect(campaignStatusDisplayLabel(campaign)).toBe("Procesando");
  });
});
