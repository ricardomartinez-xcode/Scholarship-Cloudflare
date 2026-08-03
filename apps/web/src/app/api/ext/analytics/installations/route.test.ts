import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  register: vi.fn(),
  checkRateLimit: vi.fn(),
}));

vi.mock("@/lib/extension-analytics", () => ({
  registerExtensionAnalyticsInstallation: mocks.register,
}));
vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: mocks.checkRateLimit,
}));

import { POST } from "./route";

const installationId = "82a60b2f-612c-46be-96a5-a7f46784629a";
const installationProof = "proof_abcdefghijklmnopqrstuvwxyz1234567890";

function request(body: unknown) {
  return new Request("https://recalc.relead.com.mx/api/ext/analytics/installations", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": "127.0.0.1" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/ext/analytics/installations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.checkRateLimit.mockResolvedValue({ ok: true, remaining: 19 });
    mocks.register.mockResolvedValue({
      id: installationId,
      nameId: "Ricardo_UNIDEP",
      extensionVersion: "10.6.0",
    });
  });

  it("registra una instalación por Name_ID sin sesión de usuario", async () => {
    const response = await POST(
      request({
        installationId,
        installationProof,
        nameId: "Ricardo_UNIDEP",
        extensionVersion: "10.6.0",
      }),
    );

    expect(response.status).toBe(200);
    expect(mocks.register).toHaveBeenCalledWith(
      expect.objectContaining({
        installationId,
        installationProof,
        nameId: "Ricardo_UNIDEP",
      }),
    );
    await expect(response.json()).resolves.toMatchObject({ ok: true });
  });

  it("rechaza payloads incompletos", async () => {
    const response = await POST(request({ nameId: "R" }));
    expect(response.status).toBe(400);
    expect(mocks.register).not.toHaveBeenCalled();
  });

  it("aplica rate limit antes del registro", async () => {
    mocks.checkRateLimit.mockResolvedValue({ ok: false, retryAfterMs: 5000 });
    const response = await POST(
      request({ installationId, installationProof, nameId: "Ricardo_UNIDEP" }),
    );
    expect(response.status).toBe(429);
    expect(mocks.register).not.toHaveBeenCalled();
  });

  it("no reemplaza una instalación registrada con otra prueba técnica", async () => {
    mocks.register.mockRejectedValue(new Error("La instalación ya existe con otra prueba técnica."));
    const response = await POST(
      request({ installationId, installationProof, nameId: "Ricardo_UNIDEP" }),
    );
    expect(response.status).toBe(409);
  });
});
