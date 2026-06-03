import { AdminCapability, Role } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  adminUserCapability: {
    findMany: vi.fn(),
  },
}));

const getIssuedExtensionSessionMock = vi.hoisted(() => vi.fn());

vi.mock("server-only", () => ({}));

vi.mock("@/lib/prisma", () => ({
  prisma: prismaMock,
}));

vi.mock("@/lib/extension-session-tokens", () => ({
  getIssuedExtensionSession: getIssuedExtensionSessionMock,
}));

describe("recalc public control api", () => {
  beforeEach(() => {
    prismaMock.adminUserCapability.findMany.mockReset();
    getIssuedExtensionSessionMock.mockReset();
  });

  it("requires a bearer token", async () => {
    const { requireRecalcPublicApiCapability } = await import(
      "@/lib/recalc-public-control-api"
    );

    const result = await requireRecalcPublicApiCapability(
      new Request("https://recalc.test/api/public/recalc/status"),
      "test_request",
      AdminCapability.view_admin_operations,
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.response.status).toBe(401);
    await expect(result.response.json()).resolves.toMatchObject({
      errorCode: "PUBLIC_API_BEARER_REQUIRED",
    });
  });

  it("rejects issued tokens outside the public api scope", async () => {
    getIssuedExtensionSessionMock.mockResolvedValue({
      scope: "extension:chrome-sidepanel",
      expiresAt: new Date("2026-06-03T00:00:00.000Z"),
      user: {
        id: "00000000-0000-0000-0000-000000000001",
        email: "admin@unidep.edu.mx",
        role: Role.owner,
        isActive: true,
      },
    });

    const { requireRecalcPublicApiCapability } = await import(
      "@/lib/recalc-public-control-api"
    );

    const result = await requireRecalcPublicApiCapability(
      new Request("https://recalc.test/api/public/recalc/status", {
        headers: { authorization: "Bearer rx_ext_token.secret" },
      }),
      "test_request",
      AdminCapability.view_admin_operations,
    );

    expect(result.ok).toBe(false);
    expect(prismaMock.adminUserCapability.findMany).not.toHaveBeenCalled();
    if (result.ok) return;
    expect(result.response.status).toBe(403);
    await expect(result.response.json()).resolves.toMatchObject({
      errorCode: "PUBLIC_API_SCOPE_REQUIRED",
    });
  });

  it("authorizes scoped owner tokens for required capabilities", async () => {
    getIssuedExtensionSessionMock.mockResolvedValue({
      scope: "public-api:recalc",
      expiresAt: new Date("2026-06-03T00:00:00.000Z"),
      user: {
        id: "00000000-0000-0000-0000-000000000001",
        email: "admin@unidep.edu.mx",
        role: Role.owner,
        isActive: true,
      },
    });
    prismaMock.adminUserCapability.findMany.mockResolvedValue([]);

    const { requireRecalcPublicApiCapability } = await import(
      "@/lib/recalc-public-control-api"
    );

    const result = await requireRecalcPublicApiCapability(
      new Request("https://recalc.test/api/public/recalc/offers", {
        headers: { authorization: "Bearer rx_ext_token.secret" },
      }),
      "test_request",
      AdminCapability.manage_offers,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.actor.email).toBe("admin@unidep.edu.mx");
    expect(result.actor.capabilities).toContain(AdminCapability.manage_offers);
  });

  it("exposes an OpenAPI schema usable by GPT Actions", async () => {
    const { getRecalcPublicApiOpenApiSpec } = await import(
      "@/lib/recalc-public-control-api"
    );

    const spec = getRecalcPublicApiOpenApiSpec("https://recalc.relead.com.mx");

    expect(spec.openapi).toBe("3.1.0");
    expect(spec.components.securitySchemes.recalcBearer).toMatchObject({
      type: "http",
      scheme: "bearer",
    });
    expect(spec.paths).toHaveProperty("/api/public/recalc/openapi.json");
    expect(spec.paths).toHaveProperty("/api/public/recalc/offers");
    expect(spec.paths).toHaveProperty("/api/public/recalc/prices/overrides");
    expect(spec.paths).toHaveProperty("/api/public/recalc/benefits/base-scholarships");
    expect(spec.paths).toHaveProperty("/api/public/recalc/quotes/simulate");
  });
});
