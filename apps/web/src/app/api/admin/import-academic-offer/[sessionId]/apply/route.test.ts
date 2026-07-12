import {
  AdminCapability,
  AdminConfigModule,
  AdminImportSessionStatus,
} from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireAdminApiCapability: vi.fn(),
  applyPreparedAcademicOfferImport: vi.fn(),
  redirectAdminImportPublicationIfNeeded: vi.fn(),
  validateAdminImportPublicationConfirmation: vi.fn(),
  assertImportSessionCanApply: vi.fn(),
  getAdminImportSession: vi.fn(),
  markAdminImportSessionApplied: vi.fn(),
  markAdminImportSessionFailed: vi.fn(),
  writeBusinessEventSafe: vi.fn(),
  revalidatePath: vi.fn(),
  revalidatePublicRouteTags: vi.fn(),
  getPublicRouteTagsForModule: vi.fn(),
  captureException: vi.fn(),
  logStructured: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: mocks.revalidatePath,
}));

vi.mock("@/lib/api-auth", () => ({
  requireAdminApiCapability: mocks.requireAdminApiCapability,
}));

vi.mock("@/lib/admin-api", () => ({
  buildAdminRequestId: () => "request-offer-import",
}));

vi.mock("@/lib/admin-config-modules", () => ({
  getAdminConfigModulePaths: () => ["/admin/oferta", "/api/public/oferta"],
}));

vi.mock("@/lib/business-events", () => ({
  writeBusinessEventSafe: mocks.writeBusinessEventSafe,
}));

vi.mock("@/lib/importers/academic-offer-replace", () => ({
  applyPreparedAcademicOfferImport: mocks.applyPreparedAcademicOfferImport,
}));

vi.mock("@/lib/importers/admin-import-publication", () => ({
  redirectAdminImportPublicationIfNeeded:
    mocks.redirectAdminImportPublicationIfNeeded,
  validateAdminImportPublicationConfirmation:
    mocks.validateAdminImportPublicationConfirmation,
}));

vi.mock("@/lib/importers/admin-import-sessions", () => ({
  assertImportSessionCanApply: mocks.assertImportSessionCanApply,
  getAdminImportSession: mocks.getAdminImportSession,
  markAdminImportSessionApplied: mocks.markAdminImportSessionApplied,
  markAdminImportSessionFailed: mocks.markAdminImportSessionFailed,
}));

vi.mock("@/lib/observability", () => ({
  captureException: mocks.captureException,
  logStructured: mocks.logStructured,
}));

vi.mock("@/lib/public-route-cache", () => ({
  getPublicRouteTagsForModule: mocks.getPublicRouteTagsForModule,
  revalidatePublicRouteTags: mocks.revalidatePublicRouteTags,
}));

describe("POST admin academic-offer import apply", () => {
  beforeEach(() => {
    vi.resetModules();
    for (const mock of Object.values(mocks)) mock.mockReset();

    mocks.requireAdminApiCapability.mockResolvedValue({
      ok: true,
      admin: { id: "admin-1", email: "admin@example.com" },
    });
    mocks.redirectAdminImportPublicationIfNeeded.mockReturnValue(null);
    mocks.validateAdminImportPublicationConfirmation.mockResolvedValue({ ok: true });
    mocks.getAdminImportSession.mockResolvedValue({
      id: "session-1",
      module: AdminConfigModule.OFFER,
      status: AdminImportSessionStatus.preview,
      payload: { cycle: "C3", parsed: [] },
      result: null,
    });
    mocks.applyPreparedAcademicOfferImport.mockResolvedValue({
      ok: true,
      cycle: "C3",
      campusesProcessed: 1,
      programs: { created: 0, updated: 0 },
      offerings: { created: 1, updated: 0, reactivated: 0, deactivated: 0 },
      warnings: [],
      detectedSheets: { online: "Online", planteles: "Planteles" },
      detectedColumns: null,
      perCampus: [],
    });
    mocks.getPublicRouteTagsForModule.mockReturnValue(["public:oferta"]);
  });

  it("requires operations and offer-management capabilities before publishing", async () => {
    const { POST } = await import("./route");
    const response = await POST(
      new Request(
        "https://recalc.local/api/admin/import-academic-offer/session-1/apply",
        { method: "POST" },
      ),
      { params: Promise.resolve({ sessionId: "session-1" }) },
    );

    expect(response.status).toBe(200);
    expect(mocks.requireAdminApiCapability.mock.calls).toEqual([
      ["request-offer-import", AdminCapability.view_admin_operations],
      ["request-offer-import", AdminCapability.manage_offers],
    ]);
    expect(mocks.markAdminImportSessionApplied).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId: "session-1",
        module: AdminConfigModule.OFFER,
        requestId: "request-offer-import",
      }),
    );
  });

  it("invalidates quote catalog paths and tags after a successful publication", async () => {
    const { POST } = await import("./route");
    await POST(
      new Request(
        "https://recalc.local/api/admin/import-academic-offer/session-1/apply?mode=replace",
        { method: "POST" },
      ),
      { params: Promise.resolve({ sessionId: "session-1" }) },
    );

    expect(mocks.applyPreparedAcademicOfferImport).toHaveBeenCalledWith(
      expect.objectContaining({ mode: "replace" }),
    );
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/admin/oferta");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/api/public/oferta");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/admin/importaciones");
    expect(mocks.revalidatePath).toHaveBeenCalledWith(
      "/admin/importaciones/session-1",
    );
    expect(mocks.revalidatePublicRouteTags).toHaveBeenCalledWith([
      "public:oferta",
    ]);
  });

  it("keeps an applied session successful when cache revalidation fails", async () => {
    mocks.revalidatePath.mockImplementationOnce(() => {
      throw new Error("cache unavailable");
    });

    const { POST } = await import("./route");
    const response = await POST(
      new Request(
        "https://recalc.local/api/admin/import-academic-offer/session-1/apply",
        { method: "POST" },
      ),
      { params: Promise.resolve({ sessionId: "session-1" }) },
    );

    expect(response.status).toBe(200);
    expect(mocks.markAdminImportSessionApplied).toHaveBeenCalledTimes(1);
    expect(mocks.markAdminImportSessionFailed).not.toHaveBeenCalled();
    expect(mocks.captureException).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({ action: "revalidate", result: "failure" }),
      "Academic offer import cache revalidation failed",
    );
  });

  it("does not load the session when offer-management permission is denied", async () => {
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
      new Request(
        "https://recalc.local/api/admin/import-academic-offer/session-1/apply",
        { method: "POST" },
      ),
      { params: Promise.resolve({ sessionId: "session-1" }) },
    );

    expect(response.status).toBe(403);
    expect(mocks.getAdminImportSession).not.toHaveBeenCalled();
    expect(mocks.applyPreparedAcademicOfferImport).not.toHaveBeenCalled();
  });
});
