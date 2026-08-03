import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  sync: vi.fn(),
  checkRateLimit: vi.fn(),
}));

vi.mock("@/lib/extension-analytics", () => ({
  syncExtensionAnalytics: mocks.sync,
}));
vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: mocks.checkRateLimit,
}));

import { POST } from "./route";

const installationId = "82a60b2f-612c-46be-96a5-a7f46784629a";
const installationProof = "proof_abcdefghijklmnopqrstuvwxyz1234567890";
const campaignId = "115a4a15-cb9d-4631-b72c-a1533c84fb8f";

function request(body: unknown, authenticated = true) {
  const headers = new Headers({ "content-type": "application/json" });
  if (authenticated) {
    headers.set("x-recalc-installation-id", installationId);
    headers.set("x-recalc-installation-proof", installationProof);
    headers.set("x-extension-version", "10.6.0");
  }
  return new Request("https://recalc.relead.com.mx/api/ext/analytics/sync", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}

describe("POST /api/ext/analytics/sync", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.checkRateLimit.mockResolvedValue({ ok: true, remaining: 119 });
    mocks.sync.mockResolvedValue({
      installationId,
      nameId: "Ricardo_UNIDEP",
      syncedAt: "2026-08-03T02:00:00.000Z",
      campaignsAccepted: 1,
      recipientsAccepted: 0,
      eventsAccepted: 0,
    });
  });

  it("acepta snapshots firmados por la instalación sin login", async () => {
    const response = await POST(
      request({
        nameId: "Ricardo_UNIDEP",
        campaigns: [{ id: campaignId, campaignName: "Prueba real", totalCount: 1 }],
      }),
    );

    expect(response.status).toBe(200);
    expect(mocks.sync).toHaveBeenCalledWith(
      expect.objectContaining({
        installationId,
        installationProof,
        nameId: "Ricardo_UNIDEP",
        extensionVersion: "10.6.0",
      }),
    );
    await expect(response.json()).resolves.toMatchObject({ ok: true });
  });

  it("rechaza sincronización sin identidad técnica", async () => {
    const response = await POST(request({ campaigns: [] }, false));
    expect(response.status).toBe(401);
    expect(mocks.sync).not.toHaveBeenCalled();
  });

  it("rechaza cargas que exceden el contrato", async () => {
    const response = await POST(
      request({
        campaigns: Array.from({ length: 21 }, (_, index) => ({
          id: index === 0 ? campaignId : crypto.randomUUID(),
          campaignName: `Campaña ${index}`,
        })),
      }),
    );
    expect(response.status).toBe(400);
    expect(mocks.sync).not.toHaveBeenCalled();
  });

  it("propaga una prueba técnica inválida como 401", async () => {
    mocks.sync.mockRejectedValue(new Error("Instalación no autorizada."));
    const response = await POST(request({ campaigns: [] }));
    expect(response.status).toBe(401);
  });

  it("aplica rate limit por instalación", async () => {
    mocks.checkRateLimit.mockResolvedValue({ ok: false, retryAfterMs: 1000 });
    const response = await POST(request({ campaigns: [] }));
    expect(response.status).toBe(429);
    expect(mocks.sync).not.toHaveBeenCalled();
  });
});
