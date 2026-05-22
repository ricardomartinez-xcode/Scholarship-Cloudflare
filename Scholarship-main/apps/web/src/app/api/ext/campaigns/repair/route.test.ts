import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  getSessionUserMock,
  previewExtensionCampaignRepairMock,
  applyExtensionCampaignRepairMock,
} = vi.hoisted(() => ({
  getSessionUserMock: vi.fn(),
  previewExtensionCampaignRepairMock: vi.fn(),
  applyExtensionCampaignRepairMock: vi.fn(),
}));

vi.mock("@/lib/authz", () => ({
  getSessionUser: getSessionUserMock,
}));

vi.mock("@/services/extensionCampaignRepairService", () => ({
  previewExtensionCampaignRepair: previewExtensionCampaignRepairMock,
  applyExtensionCampaignRepair: applyExtensionCampaignRepairMock,
}));

import { POST } from "./route";

function buildRequest(body: Record<string, unknown>) {
  return new Request("http://localhost/api/ext/campaigns/repair", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function buildPreviewReport() {
  return {
    mode: "preview",
    requestId: "preview_req",
    generatedAt: new Date("2026-01-01T00:00:00.000Z").toISOString(),
    runner: {
      available: true,
      isHealthy: true,
      status: "online",
      staleAfterMs: 30_000,
      lastHeartbeatAt: null,
      lastHeartbeatAgeMs: null,
      lastEventType: null,
      lastRunId: null,
      message: "ok",
    },
    findings: [],
    actions: [],
    summary: {
      campaignsAnalyzed: 1,
      findings: 0,
      safeActions: 0,
      reviewActions: 0,
      appliedActions: 0,
      releasedClaimedRecipients: 0,
      reconciledCampaigns: 0,
    },
  };
}

function buildApplyReport() {
  return {
    ...buildPreviewReport(),
    mode: "apply",
    applied: {
      appliedActions: 1,
      releasedClaimedRecipients: 2,
      reconciledCampaigns: 1,
      updatedCampaignIds: ["camp_1"],
    },
  };
}

describe("POST /api/ext/campaigns/repair", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSessionUserMock.mockResolvedValue({
      status: "ok",
      user: { id: "user_1" },
    });
    previewExtensionCampaignRepairMock.mockResolvedValue(buildPreviewReport());
    applyExtensionCampaignRepairMock.mockResolvedValue(buildApplyReport());
  });

  it("ejecuta preview por defecto y propaga requestId al servicio", async () => {
    const response = await POST(buildRequest({ campaignId: "  camp_1  " }));
    const data = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(200);
    expect(data.ok).toBe(true);
    expect(data.mode).toBe("preview");
    expect(data.scope).toBe("campaign");
    expect(String(data.requestId)).toMatch(/^ext_campaign_repair_/);
    expect(previewExtensionCampaignRepairMock).toHaveBeenCalledTimes(1);
    expect(applyExtensionCampaignRepairMock).not.toHaveBeenCalled();

    const previewParams = previewExtensionCampaignRepairMock.mock.calls[0]?.[0] as Record<
      string,
      unknown
    >;
    expect(previewParams.userId).toBe("user_1");
    expect(previewParams.campaignId).toBe("camp_1");
    expect(previewParams.requestId).toBe(data.requestId);
  });

  it("ejecuta apply scoped y respeta staleClaimAfterMs", async () => {
    const response = await POST(
      buildRequest({
        mode: "apply",
        campaignId: "camp_2",
        staleClaimAfterMs: 180_000,
      }),
    );
    const data = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(200);
    expect(data.ok).toBe(true);
    expect(data.mode).toBe("apply");
    expect(data.scope).toBe("campaign");
    expect(applyExtensionCampaignRepairMock).toHaveBeenCalledTimes(1);

    const applyParams = applyExtensionCampaignRepairMock.mock.calls[0]?.[0] as Record<
      string,
      unknown
    >;
    expect(applyParams.campaignId).toBe("camp_2");
    expect(applyParams.staleClaimAfterMs).toBe(180_000);
  });

  it("bloquea apply global accidental sin confirmación explícita", async () => {
    const response = await POST(buildRequest({ mode: "apply" }));
    const data = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(400);
    expect(data.ok).toBe(false);
    expect(String(data.error)).toContain("allowGlobalApply");
    expect(applyExtensionCampaignRepairMock).not.toHaveBeenCalled();
    expect(previewExtensionCampaignRepairMock).not.toHaveBeenCalled();
  });

  it("permite apply global cuando allowGlobalApply=true", async () => {
    const response = await POST(
      buildRequest({
        mode: "apply",
        allowGlobalApply: true,
      }),
    );
    const data = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(200);
    expect(data.ok).toBe(true);
    expect(data.scope).toBe("global");
    expect(applyExtensionCampaignRepairMock).toHaveBeenCalledTimes(1);

    const applyParams = applyExtensionCampaignRepairMock.mock.calls[0]?.[0] as Record<
      string,
      unknown
    >;
    expect(applyParams.campaignId).toBeNull();
  });

  it("rechaza campaignId vacío para evitar apply/preview ambiguo", async () => {
    const response = await POST(
      buildRequest({
        mode: "preview",
        campaignId: "   ",
      }),
    );
    const data = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(400);
    expect(data.ok).toBe(false);
    expect(previewExtensionCampaignRepairMock).not.toHaveBeenCalled();
  });

  it("retorna 401 cuando no hay sesión autenticada", async () => {
    getSessionUserMock.mockResolvedValueOnce({ status: "unauthenticated" });

    const response = await POST(
      buildRequest({
        mode: "preview",
        campaignId: "camp_3",
      }),
    );
    const data = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(401);
    expect(data.ok).toBe(false);
    expect(data.error).toBe("unauthenticated");
    expect(String(data.requestId)).toMatch(/^ext_campaign_repair_/);
    expect(previewExtensionCampaignRepairMock).not.toHaveBeenCalled();
    expect(applyExtensionCampaignRepairMock).not.toHaveBeenCalled();
  });
});

