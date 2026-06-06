import { AdminCapability } from "@prisma/client";
import { NextResponse } from "next/server";

import { adminApiError, buildAdminRequestId, logAdminApiFailure } from "@/lib/admin-api";
import {
  canAccessAdminPanel,
  hasAnyAdminCapability,
  resolveAdminCapabilities,
} from "@/lib/admin-capabilities";
import { getIssuedExtensionSession } from "@/lib/extension-session-tokens";
import { prisma } from "@/lib/prisma";

export const RECALC_PUBLIC_API_SCOPE = "public-api:recalc";
export const RECALC_PUBLIC_API_DEFAULT_TTL_MS = 1000 * 60 * 60 * 24;
export const RECALC_PUBLIC_API_MAX_TTL_MS = RECALC_PUBLIC_API_DEFAULT_TTL_MS;

type RecalcPublicApiActor = {
  id: string;
  email: string;
  role: string;
  capabilities: AdminCapability[];
};

type RecalcPublicApiAuthResult =
  | { ok: true; actor: RecalcPublicApiActor }
  | { ok: false; response: NextResponse };

function toRequiredCapabilities(capability: AdminCapability | AdminCapability[]) {
  return Array.isArray(capability) ? capability : [capability];
}

export function readRecalcPublicApiBearerToken(request: Request) {
  const authorization = request.headers.get("authorization")?.trim() ?? "";
  if (!authorization.toLowerCase().startsWith("bearer ")) return "";
  return authorization.slice(7).trim();
}

function publicApiAuthError(requestId: string, status: number, errorCode: string, error: string) {
  return adminApiError({
    requestId,
    status,
    errorCode,
    error,
    recoverable: status !== 403,
  });
}

export async function requireRecalcPublicApiCapability(
  request: Request,
  requestId: string,
  capability: AdminCapability | AdminCapability[],
): Promise<RecalcPublicApiAuthResult> {
  const token = readRecalcPublicApiBearerToken(request);
  if (!token) {
    return {
      ok: false,
      response: publicApiAuthError(
        requestId,
        401,
        "PUBLIC_API_BEARER_REQUIRED",
        "Configura Authorization: Bearer <token> para usar la API publica de Recalc.",
      ),
    };
  }

  try {
    const session = await getIssuedExtensionSession(token);
    if (!session || !session.user.isActive) {
      return {
        ok: false,
        response: publicApiAuthError(
          requestId,
          401,
          "PUBLIC_API_TOKEN_INVALID",
          "El token de API publica no es valido o ya expiro.",
        ),
      };
    }

    if (session.scope !== RECALC_PUBLIC_API_SCOPE) {
      return {
        ok: false,
        response: publicApiAuthError(
          requestId,
          403,
          "PUBLIC_API_SCOPE_REQUIRED",
          "El token no fue emitido para la API publica de Recalc.",
        ),
      };
    }

    const overrides = await prisma.adminUserCapability.findMany({
      where: { userId: session.user.id },
      select: { capability: true, enabled: true },
    });
    const capabilitySet = resolveAdminCapabilities(session.user.role, overrides);
    if (!canAccessAdminPanel(session.user.role, capabilitySet)) {
      return {
        ok: false,
        response: publicApiAuthError(
          requestId,
          403,
          "PUBLIC_API_ADMIN_ACCESS_REQUIRED",
          "La cuenta no tiene acceso administrativo activo.",
        ),
      };
    }

    const required = toRequiredCapabilities(capability);
    if (!hasAnyAdminCapability(capabilitySet, required)) {
      return {
        ok: false,
        response: publicApiAuthError(
          requestId,
          403,
          "PUBLIC_API_CAPABILITY_REQUIRED",
          "La cuenta no tiene la capacidad requerida para esta operacion.",
        ),
      };
    }

    return {
      ok: true,
      actor: {
        id: session.user.id,
        email: session.user.email,
        role: session.user.role,
        capabilities: Array.from(capabilitySet).sort(),
      },
    };
  } catch (error) {
    logAdminApiFailure({
      requestId,
      module: "recalc-public-api",
      action: "authorize",
      error,
    });
    return {
      ok: false,
      response: publicApiAuthError(
        requestId,
        401,
        "PUBLIC_API_TOKEN_REJECTED",
        "No fue posible validar el token de API publica.",
      ),
    };
  }
}

export async function forwardRecalcPublicApiRequest(
  request: Request,
  capability: AdminCapability | AdminCapability[],
  run: () => Promise<Response>,
) {
  const requestId = buildAdminRequestId("public_recalc_api");
  const auth = await requireRecalcPublicApiCapability(request, requestId, capability);
  if (!auth.ok) return auth.response;
  return run();
}

export function clampRecalcPublicApiTtlMs(value: unknown) {
  const requestedHours = Number(value ?? 24);
  if (!Number.isFinite(requestedHours)) return RECALC_PUBLIC_API_DEFAULT_TTL_MS;
  const requested = Math.trunc(requestedHours * 60 * 60 * 1000);
  return Math.min(
    RECALC_PUBLIC_API_MAX_TTL_MS,
    Math.max(1000 * 60 * 5, requested),
  );
}

const jsonResponse = {
  description: "Respuesta JSON de Recalc.",
  content: {
    "application/json": {
      schema: { type: "object", additionalProperties: true },
    },
  },
};

const errorResponses = {
  "400": jsonResponse,
  "401": jsonResponse,
  "403": jsonResponse,
  "422": jsonResponse,
  "500": jsonResponse,
};

const secured = [{ recalcBearer: [] }];

function pathSecurity(summary: string, operationId: string, extra: Record<string, unknown> = {}) {
  return {
    summary,
    operationId,
    security: secured,
    responses: {
      "200": jsonResponse,
      ...errorResponses,
    },
    ...extra,
  };
}

function postJson(summary: string, operationId: string, schema: Record<string, unknown>) {
  return pathSecurity(summary, operationId, {
    requestBody: {
      required: true,
      content: {
        "application/json": { schema },
      },
    },
  });
}

function fileImport(summary: string, operationId: string) {
  return pathSecurity(summary, operationId, {
    requestBody: {
      required: true,
      content: {
        "multipart/form-data": {
          schema: {
            type: "object",
            required: ["file"],
            properties: {
              file: { type: "string", format: "binary" },
              cycle: { type: "string", enum: ["C1", "C2", "C3"] },
              dryRun: { type: "boolean" },
            },
          },
        },
      },
    },
  });
}

const applyImport = postJson("Aplicar una sesion de importacion validada.", "applyImportSession", {
  type: "object",
  properties: {
    confirm: { type: "string", enum: ["PUBLICAR"] },
    confirmation: { type: "string", enum: ["PUBLICAR"] },
    publish: { type: "boolean" },
  },
  additionalProperties: true,
});

export function getRecalcPublicApiOpenApiSpec(origin: string) {
  const serverUrl = origin.replace(/\/+$/, "");

  return {
    openapi: "3.1.0",
    info: {
      title: "Recalc Public Control API",
      version: "2026-06-03",
      description:
        "API protegida por Bearer token para controlar Recalc desde GPT Actions u otros clientes por cuenta.",
    },
    servers: [{ url: serverUrl }],
    security: secured,
    paths: {
      "/api/public/recalc/openapi.json": {
        get: {
          summary: "Descargar el OpenAPI Schema de Recalc.",
          operationId: "getRecalcOpenApiSchema",
          security: [],
          responses: {
            "200": jsonResponse,
          },
        },
      },
      "/api/public/recalc/tokens": {
        post: pathSecurity("Emitir token Bearer personal para GPT Actions.", "issueRecalcToken", {
          requestBody: {
            required: false,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    client: { type: "string", maxLength: 80 },
                    ttlHours: { type: "number", minimum: 0.083, maximum: 24 },
                  },
                },
              },
            },
          },
        }),
        delete: pathSecurity("Revocar el Bearer token actual.", "revokeRecalcToken"),
      },
      "/api/public/recalc/status": {
        get: pathSecurity("Consultar estado general de Recalc.", "getRecalcStatus"),
      },
      "/api/public/recalc/config": {
        get: pathSecurity("Consultar configuracion operativa segura.", "getRecalcConfig"),
        patch: postJson("Actualizar configuracion operativa segura.", "updateRecalcConfig", {
          type: "object",
          properties: {
            activeCycle: { type: "string", enum: ["C1", "C2", "C3"] },
            visibleCycles: {
              type: "array",
              items: { type: "string", enum: ["C1", "C2", "C3"] },
              minItems: 1,
            },
            importerFlags: { type: "object", additionalProperties: { type: "boolean" } },
            quoteFlags: { type: "object", additionalProperties: { type: "boolean" } },
          },
          additionalProperties: false,
        }),
      },
      "/api/public/recalc/audit-log": {
        get: pathSecurity("Consultar auditoria administrativa paginada.", "listRecalcAuditLog", {
          parameters: [
            { name: "page", in: "query", schema: { type: "integer", minimum: 1 } },
            { name: "pageSize", in: "query", schema: { type: "integer", minimum: 1, maximum: 200 } },
            { name: "module", in: "query", schema: { type: "string" } },
            { name: "action", in: "query", schema: { type: "string" } },
            { name: "user", in: "query", schema: { type: "string" } },
            { name: "from", in: "query", schema: { type: "string", format: "date-time" } },
            { name: "to", in: "query", schema: { type: "string", format: "date-time" } },
          ],
        }),
      },
      "/api/public/recalc/offers": {
        get: pathSecurity("Listar ofertas academicas administrables.", "listRecalcOffers", {
          parameters: [
            { name: "cycle", in: "query", schema: { type: "string", enum: ["C1", "C2", "C3"] } },
            { name: "campus", in: "query", schema: { type: "string" } },
            { name: "program", in: "query", schema: { type: "string" } },
            { name: "modality", in: "query", schema: { type: "string" } },
            { name: "plan", in: "query", schema: { type: "integer" } },
            { name: "status", in: "query", schema: { type: "string", enum: ["active", "inactive"] } },
            { name: "page", in: "query", schema: { type: "integer", minimum: 1 } },
            { name: "pageSize", in: "query", schema: { type: "integer", minimum: 1, maximum: 200 } },
          ],
        }),
      },
      "/api/public/recalc/offers/{id}/status": {
        patch: postJson("Activar, desactivar o archivar una oferta academica.", "updateRecalcOfferStatus", {
          type: "object",
          required: ["isActive"],
          properties: {
            isActive: { type: "boolean" },
            archivedReason: { type: "string" },
          },
        }),
      },
      "/api/public/recalc/importers/academic-offer/validate": {
        post: postJson("Validar oferta academica desde CSV o filas JSON.", "validateAcademicOfferImport", {
          type: "object",
          properties: {
            cycle: { type: "string", enum: ["C1", "C2", "C3"] },
            csv: { type: "string" },
            rows: { type: "array", items: { type: "object", additionalProperties: true } },
            fileName: { type: "string" },
          },
          additionalProperties: false,
        }),
      },
      "/api/public/recalc/importers/academic-offer": {
        post: postJson("Aplicar o hacer dry-run de oferta academica.", "applyAcademicOfferImport", {
          type: "object",
          properties: {
            cycle: { type: "string", enum: ["C1", "C2", "C3"] },
            dryRun: { type: "boolean" },
            csv: { type: "string" },
            rows: { type: "array", items: { type: "object", additionalProperties: true } },
            fileName: { type: "string" },
          },
          additionalProperties: false,
        }),
      },
      "/api/public/recalc/importers/prices": {
        post: fileImport("Validar importacion de precios.", "validatePricesImport"),
      },
      "/api/public/recalc/prices/overrides": {
        post: postJson("Crear o actualizar un override manual de precio.", "upsertPriceOverride", {
          type: "object",
          required: ["targetKeys", "newPrice"],
          properties: {
            id: { type: "string" },
            scope: { type: "string", default: "base_price" },
            targetKeys: { type: "object", additionalProperties: true },
            newPrice: { type: "number", minimum: 0 },
            isActive: { type: "boolean", default: true },
            notes: { type: "string" },
          },
          additionalProperties: false,
        }),
      },
      "/api/public/recalc/prices/overrides/{id}": {
        delete: pathSecurity("Eliminar un override manual de precio.", "deletePriceOverride", {
          parameters: [
            { name: "id", in: "path", required: true, schema: { type: "string" } },
          ],
        }),
      },
      "/api/public/recalc/importers/prices/{sessionId}/apply": {
        post: applyImport,
      },
      "/api/public/recalc/importers/prices/{sessionId}/rollback": {
        post: pathSecurity("Revertir una importacion de precios aplicada.", "rollbackPricesImport"),
      },
      "/api/public/recalc/importers/benefits": {
        post: fileImport("Validar importacion de beneficios.", "validateBenefitsImport"),
      },
      "/api/public/recalc/importers/benefits/{sessionId}/apply": {
        post: applyImport,
      },
      "/api/public/recalc/importers/benefits/{sessionId}/rollback": {
        post: pathSecurity("Revertir una importacion de beneficios aplicada.", "rollbackBenefitsImport"),
      },
      "/api/public/recalc/importers/base-scholarships": {
        post: fileImport("Validar importacion de becas por promedio.", "validateBaseScholarshipsImport"),
      },
      "/api/public/recalc/benefits/base-scholarships": {
        post: postJson("Crear o actualizar una regla manual de beca base.", "upsertBaseScholarship", {
          type: "object",
          required: [
            "enrollmentType",
            "businessLine",
            "modality",
            "plan",
            "minAverage",
            "maxAverage",
            "scholarshipPercent",
          ],
          properties: {
            id: { type: "string" },
            enrollmentType: { type: "string", enum: ["nuevo_ingreso", "regreso", "reingreso"] },
            businessLine: { type: "string", enum: ["salud", "licenciatura", "prepa", "posgrado"] },
            modality: { type: "string", enum: ["presencial", "mixta", "online"] },
            plan: { type: "integer", minimum: 1 },
            campusTier: { type: "string", default: "ANY" },
            region: { type: "string" },
            plantel: { type: "string" },
            programaKey: { type: "string" },
            minAverage: { type: "number", minimum: 0, maximum: 10 },
            maxAverage: { type: "number", minimum: 0, maximum: 10 },
            scholarshipPercent: { type: "number", minimum: 0, maximum: 100 },
          },
          additionalProperties: false,
        }),
      },
      "/api/public/recalc/benefits/base-scholarships/{id}": {
        delete: pathSecurity("Eliminar una regla manual de beca base.", "deleteBaseScholarship", {
          parameters: [
            { name: "id", in: "path", required: true, schema: { type: "string" } },
          ],
        }),
      },
      "/api/public/recalc/importers/base-scholarships/{sessionId}/apply": {
        post: applyImport,
      },
      "/api/public/recalc/importers/base-scholarships/{sessionId}/rollback": {
        post: pathSecurity("Revertir una importacion de becas por promedio.", "rollbackBaseScholarshipsImport"),
      },
      "/api/public/recalc/quotes/diagnose": {
        post: postJson("Diagnosticar una cotizacion canonica.", "diagnoseRecalcQuote", {
          $ref: "#/components/schemas/QuoteRequest",
        }),
      },
      "/api/public/recalc/quotes/simulate": {
        post: postJson("Simular una cotizacion canonica.", "simulateRecalcQuote", {
          $ref: "#/components/schemas/QuoteRequest",
        }),
      },
      "/api/public/recalc/system/health": {
        get: pathSecurity("Consultar salud tecnica del sistema.", "getRecalcSystemHealth"),
      },
      "/api/public/recalc/system/env-check": {
        get: pathSecurity("Consultar presencia de variables necesarias sin valores.", "getRecalcEnvCheck"),
      },
      "/api/public/recalc/system/importer-status": {
        get: pathSecurity("Consultar estado de importadores.", "getRecalcImporterStatus"),
      },
      "/api/public/recalc/system/quote-engine-status": {
        get: pathSecurity("Consultar estado del motor de cotizacion.", "getRecalcQuoteEngineStatus"),
      },
      "/api/public/recalc/github/repository": {
        get: pathSecurity("Consultar repositorio GitHub configurado.", "getGitHubRepository"),
      },
      "/api/public/recalc/github/pulls": {
        get: pathSecurity("Listar pull requests recientes.", "listGitHubPulls"),
      },
      "/api/public/recalc/github/actions/runs": {
        get: pathSecurity("Listar runs recientes de GitHub Actions.", "listGitHubActionRuns"),
      },
      "/api/public/recalc/github/actions/dispatch": {
        post: postJson("Disparar workflow_dispatch de GitHub.", "dispatchGitHubWorkflow", {
          type: "object",
          required: ["workflow_id", "ref"],
          properties: {
            workflow_id: { type: "string" },
            ref: { type: "string" },
            inputs: {
              type: "object",
              additionalProperties: {
                oneOf: [{ type: "string" }, { type: "number" }, { type: "boolean" }],
              },
            },
          },
        }),
      },
      "/api/public/recalc/github/commits/latest": {
        get: pathSecurity("Consultar ultimo commit del repositorio.", "getLatestGitHubCommit"),
      },
      "/api/public/recalc/github/issues": {
        post: postJson("Crear issue en GitHub.", "createGitHubIssue", {
          type: "object",
          required: ["title"],
          properties: {
            title: { type: "string", maxLength: 256 },
            body: { type: "string", maxLength: 65000 },
            labels: {
              type: "array",
              maxItems: 20,
              items: { type: "string", maxLength: 80 },
            },
          },
        }),
      },
    },
    components: {
      securitySchemes: {
        recalcBearer: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "rx_ext",
          description:
            "Usa el token emitido por POST /api/public/recalc/tokens como Authorization: Bearer <token>.",
        },
      },
      schemas: {
        QuoteRequest: {
          type: "object",
          required: ["enrollmentType", "businessLine", "modality", "plan", "average"],
          properties: {
            enrollmentType: { type: "string", enum: ["nuevo_ingreso", "regreso", "reingreso"] },
            businessLine: { type: "string", enum: ["salud", "licenciatura", "prepa", "posgrado"] },
            modality: { type: "string", enum: ["presencial", "mixta", "online"] },
            plan: { type: "integer", minimum: 1 },
            campus: { type: "string" },
            average: { type: "number", minimum: 0, maximum: 10 },
            subjectCount: { type: "integer", minimum: 1 },
            module: { type: "string" },
            extraCharge: { type: "number", minimum: 0 },
            selectedProgramId: { type: "string" },
            selectedProgramName: { type: "string" },
            offeringId: { type: "string" },
            offerCycle: { type: "string", enum: ["C1", "C2", "C3"] },
          },
          additionalProperties: false,
        },
      },
    },
  };
}
