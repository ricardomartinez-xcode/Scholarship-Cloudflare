import { AdminCapability } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireAdminApiCapability: vi.fn(),
  prepareAcademicOfferImport: vi.fn(),
  enrichAcademicOfferImportWithModuleSheet: vi.fn(),
  captureException: vi.fn(),
  logStructured: vi.fn(),
}));

vi.mock("@/lib/api-auth", () => ({
  requireAdminApiCapability: mocks.requireAdminApiCapability,
}));

vi.mock("@/lib/admin-api", () => ({
  buildAdminRequestId: () => "request-offer-preview",
}));

vi.mock("@/lib/business-events", () => ({
  writeBusinessEventSafe: vi.fn(),
}));

vi.mock("@/lib/importers/academic-offer", () => ({
  prepareAcademicOfferImport: mocks.prepareAcademicOfferImport,
  resolveDefaultOfferExcelPath: vi.fn(),
}));

vi.mock("@/lib/importers/academic-offer-csv", () => ({
  academicOfferCsvToXlsxBuffer: vi.fn(),
  isAcademicOfferCsvFileName: vi.fn(),
}));

vi.mock("@/lib/importers/academic-offer-module-sheet", () => ({
  enrichAcademicOfferImportWithModuleSheet:
    mocks.enrichAcademicOfferImportWithModuleSheet,
}));

vi.mock("@/lib/importers/admin-import-sessions", () => ({
  createAdminImportPreviewSession: vi.fn(),
  createImportFileChecksum: vi.fn(),
}));

vi.mock("@/lib/observability", () => ({
  captureException: mocks.captureException,
  logStructured: mocks.logStructured,
}));

describe("POST admin academic-offer import preview", () => {
  beforeEach(() => {
    vi.resetModules();
    for (const mock of Object.values(mocks)) mock.mockReset();
  });

  it("requires both operations access and offer-management permission", async () => {
    mocks.requireAdminApiCapability
      .mockResolvedValueOnce({
        ok: true,
        admin: { id: "admin-1", email: "admin@example.com" },
      })
      .mockResolvedValueOnce({
        ok: false,
        response: new Response(JSON.stringify({ ok: false }), { status: 403 }),
      });

    const { POST } = await import("./route");
    const response = await POST(
      new Request("https://recalc.local/api/admin/import-academic-offer", {
        method: "POST",
      }),
    );

    expect(response.status).toBe(403);
    expect(mocks.requireAdminApiCapability.mock.calls).toEqual([
      ["request-offer-preview", AdminCapability.view_admin_operations],
      ["request-offer-preview", AdminCapability.manage_offers],
    ]);
    expect(mocks.prepareAcademicOfferImport).not.toHaveBeenCalled();
  });
});
