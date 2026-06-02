import {
  AdminConfigModule,
  AdminImportSessionStatus,
} from "@prisma/client";
import { describe, expect, it } from "vitest";

import {
  buildAdminImportSessionDetailUrl,
  getAdminImportApplyTarget,
  getAdminImportPublicationState,
  redirectAdminImportPublicationIfNeeded,
  shouldRedirectAdminImportPublication,
  validateAdminImportPublicationConfirmation,
} from "../admin-import-publication";

function buildFormRequest(values: Record<string, string>) {
  const formData = new FormData();
  for (const [key, value] of Object.entries(values)) {
    formData.set(key, value);
  }

  return new Request("https://recalc.local/admin/importaciones/session/apply", {
    method: "POST",
    body: formData,
  });
}

describe("admin import publication", () => {
  describe("validateAdminImportPublicationConfirmation", () => {
    it("acepta la confirmación explícita requerida para publicar", async () => {
      const result = await validateAdminImportPublicationConfirmation(
        buildFormRequest({
          confirmImpactReviewed: "on",
          confirmPublicationText: "PUBLICAR",
        }),
      );

      expect(result).toEqual({ ok: true });
    });

    it("rechaza solicitudes sin confirmación de impacto revisado", async () => {
      const result = await validateAdminImportPublicationConfirmation(
        buildFormRequest({ confirmPublicationText: "PUBLICAR" }),
      );

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.message).toContain("Confirma que revisaste el impacto");
      }
    });

    it("rechaza solicitudes sin texto PUBLICAR exacto", async () => {
      const result = await validateAdminImportPublicationConfirmation(
        buildFormRequest({
          confirmImpactReviewed: "on",
          confirmPublicationText: "publicar",
        }),
      );

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.message).toContain("PUBLICAR");
      }
    });

    it("rechaza llamadas directas que no envían formData", async () => {
      const request = new Request("https://recalc.local/api/admin/import/apply", {
        method: "POST",
        body: JSON.stringify({ confirmPublicationText: "PUBLICAR" }),
        headers: { "Content-Type": "application/json" },
      });

      const result = await validateAdminImportPublicationConfirmation(request);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.message).toContain("confirmación explícita");
      }
    });
  });

  describe("getAdminImportApplyTarget", () => {
    it("resuelve el endpoint de publicación para precios", () => {
      expect(
        getAdminImportApplyTarget({
          id: "session-prices",
          module: AdminConfigModule.PRICES,
          fileName: "precios.csv",
        }),
      ).toBe("/api/admin/prices/import/session-prices/apply");
    });

    it("resuelve el endpoint de publicación para beneficios", () => {
      expect(
        getAdminImportApplyTarget({
          id: "session-benefits",
          module: AdminConfigModule.BENEFITS,
          fileName: "beneficios.csv",
        }),
      ).toBe("/api/admin/benefits/import/session-benefits/apply");
    });

    it("resuelve el endpoint de publicación para becas base", () => {
      expect(
        getAdminImportApplyTarget({
          id: "session-base-scholarships",
          module: AdminConfigModule.BENEFITS,
          fileName: "base-scholarships:becas.csv",
        }),
      ).toBe("/api/admin/benefits/base-scholarships/import/session-base-scholarships/apply");
    });

    it("resuelve el endpoint de publicación para oferta académica", () => {
      expect(
        getAdminImportApplyTarget({
          id: "session-offer",
          module: AdminConfigModule.OFFER,
          fileName: "oferta.xlsx",
        }),
      ).toBe("/api/admin/import-academic-offer/session-offer/apply");
    });

    it("no genera endpoint de publicación para módulos no importables", () => {
      expect(
        getAdminImportApplyTarget({
          id: "session-sidebar",
          module: AdminConfigModule.SIDEBAR,
          fileName: "sidebar.csv",
        }),
      ).toBeNull();
    });
  });

  describe("getAdminImportPublicationState", () => {
    it("marca sesiones preview como borrador publicable", () => {
      const state = getAdminImportPublicationState(AdminImportSessionStatus.preview);

      expect(state.stage).toBe("draft");
      expect(state.actionLabel).toBe("Publicar importación");
    });

    it("marca sesiones aplicadas como publicadas sin acción pendiente", () => {
      const state = getAdminImportPublicationState(AdminImportSessionStatus.applied);

      expect(state.stage).toBe("published");
      expect(state.actionLabel).toBeNull();
    });

    it("marca sesiones fallidas como bloqueadas", () => {
      const state = getAdminImportPublicationState(AdminImportSessionStatus.failed);

      expect(state.stage).toBe("blocked");
      expect(state.actionLabel).toBeNull();
    });
  });

  describe("browser publication redirects", () => {
    it("detecta submits nativos del navegador para volver al detalle de sesión", () => {
      const request = new Request(
        "https://recalc.local/api/admin/import-academic-offer/session-offer/apply",
        {
          method: "POST",
          headers: { Accept: "text/html,application/xhtml+xml" },
        },
      );

      expect(shouldRedirectAdminImportPublication(request)).toBe(true);
      expect(
        buildAdminImportSessionDetailUrl(request, "session-offer").toString(),
      ).toBe("https://recalc.local/admin/importaciones/session-offer");
    });

    it("conserva respuesta JSON para clientes API", () => {
      const request = new Request(
        "https://recalc.local/api/admin/import-academic-offer/session-offer/apply",
        {
          method: "POST",
          headers: { Accept: "application/json" },
        },
      );

      expect(shouldRedirectAdminImportPublication(request)).toBe(false);
    });

    it("incluye error de publicación en la URL de regreso cuando aplica", () => {
      const request = new Request(
        "https://recalc.local/api/admin/import-academic-offer/session-offer/apply",
        {
          method: "POST",
          headers: { Accept: "text/html" },
        },
      );

      expect(
        buildAdminImportSessionDetailUrl(request, "session-offer", {
          publicationError: "Confirma PUBLICAR.",
        }).toString(),
      ).toBe(
        "https://recalc.local/admin/importaciones/session-offer?publicationError=Confirma+PUBLICAR.",
      );
    });

    it("devuelve redirect 303 para submits HTML sin romper clientes JSON", () => {
      const htmlRequest = new Request(
        "https://recalc.local/api/admin/import-academic-offer/session-offer/apply",
        {
          method: "POST",
          headers: { Accept: "text/html" },
        },
      );
      const jsonRequest = new Request(
        "https://recalc.local/api/admin/import-academic-offer/session-offer/apply",
        {
          method: "POST",
          headers: { Accept: "application/json" },
        },
      );

      const redirect = redirectAdminImportPublicationIfNeeded(
        htmlRequest,
        "session-offer",
      );

      expect(redirect?.status).toBe(303);
      expect(redirect?.headers.get("location")).toBe(
        "https://recalc.local/admin/importaciones/session-offer",
      );
      expect(
        redirectAdminImportPublicationIfNeeded(jsonRequest, "session-offer"),
      ).toBeNull();
    });
  });
});
