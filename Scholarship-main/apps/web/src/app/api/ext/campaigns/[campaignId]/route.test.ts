import { beforeEach, describe, expect, it, vi } from "vitest";

const authzMock = vi.hoisted(() => ({
  getSessionUser: vi.fn(),
}));

const extensionAutomationMock = vi.hoisted(() => ({
  deleteExtensionCampaignForUser: vi.fn(),
  forcePauseExtensionCampaign: vi.fn(),
  pauseExtensionCampaign: vi.fn(),
  resumeExtensionCampaign: vi.fn(),
}));

vi.mock("@/lib/authz", () => authzMock);
vi.mock("@/lib/extension-automation", () => extensionAutomationMock);

import { PATCH } from "@/app/api/ext/campaigns/[campaignId]/route";

describe("PATCH /api/ext/campaigns/[campaignId]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authzMock.getSessionUser.mockResolvedValue({
      status: "ok",
      user: { id: "user-1" },
    });
  });

  it("usa force_pause explícito y devuelve la campaña actualizada", async () => {
    const campaign = { id: "camp-1", status: "paused" };
    extensionAutomationMock.forcePauseExtensionCampaign.mockResolvedValue(campaign);

    const response = await PATCH(
      new Request("http://localhost/api/ext/campaigns/camp-1", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "force_pause" }),
      }),
      { params: Promise.resolve({ campaignId: "camp-1" }) },
    );

    expect(response.status).toBe(200);
    expect(extensionAutomationMock.forcePauseExtensionCampaign).toHaveBeenCalledWith({
      userId: "user-1",
      campaignId: "camp-1",
    });
    expect(extensionAutomationMock.pauseExtensionCampaign).not.toHaveBeenCalled();
    expect(extensionAutomationMock.resumeExtensionCampaign).not.toHaveBeenCalled();
    await expect(response.json()).resolves.toEqual({
      ok: true,
      campaign,
    });
  });

  it("retorna error explícito para acciones inválidas", async () => {
    const response = await PATCH(
      new Request("http://localhost/api/ext/campaigns/camp-1", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "invalid_action" }),
      }),
      { params: Promise.resolve({ campaignId: "camp-1" }) },
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: "La acción solicitada no es válida.",
    });
  });

  it("propaga errores backend sin ocultarlos", async () => {
    extensionAutomationMock.forcePauseExtensionCampaign.mockRejectedValue(
      new Error("No se pudo forzar pausa por estado inconsistente."),
    );

    const response = await PATCH(
      new Request("http://localhost/api/ext/campaigns/camp-1", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "force_pause" }),
      }),
      { params: Promise.resolve({ campaignId: "camp-1" }) },
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: "No se pudo forzar pausa por estado inconsistente.",
    });
  });
});
