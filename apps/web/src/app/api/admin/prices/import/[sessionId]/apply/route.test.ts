import {
  AdminConfigModule,
  AdminImportSessionStatus,
} from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireAdminApiCapability: vi.fn(),
  applyPreparedPricesImport: vi.fn(),
  redirectAdminImportPublicationIfNeeded: vi.fn(),
  validateAdminImportPublicationConfirmation: vi.fn(),
  assertImportSessionCanApply: vi.fn(),
  getAdminImportSession: vi.fn(),
  markAdminImportSessionApplied: vi.fn(),
  writeBusinessEventSafe: vi.fn(),
  revalidatePath: vi.fn(),
  logAdminApiFailure: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: mocks.revalidatePath,
}));

vi.mock("@/lib/api-auth", () => ({
  requireAdminApiCapability: mocks.requireAdminApiCapability,
}));

vi.mock("@/lib/admin-api", async () => {
  const actual =
    await vi.importActual<typeof import("@/lib/admin-api")>("@/lib/admin-api");
  return {
    ...actual,
    buildAdminRequestId: () => "request-price-import",
    logAdminApiFailure: mocks.logAdminApiFailure,
  };
});

vi.mock("@/lib/business-events", () => ({
  writeBusinessEventSafe: mocks.writeBusinessEventSafe,
}));

vi.mock("@/lib/importers/prices-csv", () => ({
  applyPreparedPricesImport: mocks.applyPreparedPricesImport,
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
}));

describe("POST admin prices import apply", () => {
  beforeEach(() => {
    vi.resetModules();
    for (const mock of Object.values(mocks)) mock.mockReset();

    mocks.requireAdminApiCapability.mockResolvedValue({
      ok: true,
      admin: {
        id: "admin-1",
        email: "admin@example.com",
      },
    });
    mocks.redirectAdminImportPublicationIfNeeded.mockReturnValue(null);
    mocks.validateAdminImportPublicationConfirmation.mockResolvedValue({
      ok: true,
    });
    mocks.getAdminImportSession.mockResolvedValue({
      id: "session-1",
      module: AdminConfigModule.PRICES,
      status: AdminImportSessionStatus.preview,
      payload: { rows: [] },
      result: null,
    });
  });

  it(
    "responde 422 y no aplica la sesión cuando la cobertura queda incompleta",
    async () => {
      const issue = {
        kind: "missing_base_price" as const,
        offeringId: "offering-1",
        cycle: "C3",
        campus: "Hermosillo",
        program: "Administración",
        businessLine: "licenciatura",
        modality: "presencial",
        plan: 9,
        module: "M1",
        tier: "T1",
        message:
          "No hay precio lista publicado para la combinación activa de oferta.",
      };
      const { POST } = await import("./route");
      const { PriceImportCoverageError } = await import(
        "@/lib/importers/price-import-integrity-guard"
      );
      mocks.applyPreparedPricesImport.mockRejectedValue(
        new PriceImportCoverageError({
          offeringsChecked: 1,
          combinationsChecked: 1,
          coveredCombinations: 0,
          issues: [issue],
          effectiveOverrides: [],
        }),
      );

      const response = await POST(
        new Request(
          "https://recalc.local/api/admin/prices/import/session-1/apply",
          { method: "POST" },
        ),
        { params: Promise.resolve({ sessionId: "session-1" }) },
      );
      const payload = await response.json();

      expect(response.status).toBe(422);
      expect(payload).toMatchObject({
        ok: false,
        errorCode: "PRICE_IMPORT_COVERAGE_INCOMPLETE",
        details: {
          offeringsChecked: 1,
          combinationsChecked: 1,
          coveredCombinations: 0,
          issues: [issue],
        },
      });
      expect(payload.details).not.toHaveProperty("effectiveOverrides");
      expect(mocks.markAdminImportSessionApplied).not.toHaveBeenCalled();
      expect(mocks.writeBusinessEventSafe).not.toHaveBeenCalled();
    },
    10_000,
  );
});
