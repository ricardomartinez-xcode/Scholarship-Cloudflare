import { AdminAuditAction, AdminCapability, AdminConfigModule, Prisma } from "@prisma/client";

import { ACADEMIC_OFFER_CYCLES, normalizeAcademicOfferCycle } from "@/config/academicOffer";
import { requireAdminApiCapability } from "@/lib/api-auth";
import { writeAdminAuditLog } from "@/lib/admin-audit";
import {
  adminApiError,
  adminApiSuccess,
  buildAdminRequestId,
  logAdminApiFailure,
} from "@/lib/admin-api";
import {
  getAcademicOfferVisibleCycles,
  saveAcademicOfferVisibleCycles,
} from "@/lib/academic-offer-config";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ACTIVE_CYCLE_KEY = "admin_control.active_cycle";
const IMPORTER_FLAGS_KEY = "admin_control.importer_flags";
const QUOTE_FLAGS_KEY = "admin_control.quote_flags";

function parseJsonObject(raw: string | null | undefined) {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

function sanitizeFlags(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const output: Record<string, boolean> = {};
  for (const [key, flagValue] of Object.entries(value)) {
    const normalizedKey = key.trim();
    if (!/^[a-zA-Z0-9_.-]{1,80}$/.test(normalizedKey)) return null;
    if (typeof flagValue !== "boolean") return null;
    output[normalizedKey] = flagValue;
  }
  return output;
}

function toAuditJson(value: unknown) {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

async function getConfigState() {
  const [visibleCycles, campuses, rows] = await Promise.all([
    getAcademicOfferVisibleCycles(),
    prisma.campus.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: { id: true, code: true, name: true, metaKey: true, kind: true, tier: true },
    }),
    prisma.adminSidebarInfo.findMany({
      where: { key: { in: [ACTIVE_CYCLE_KEY, IMPORTER_FLAGS_KEY, QUOTE_FLAGS_KEY] } },
      select: { key: true, value: true, isActive: true },
    }),
  ]);
  const rowByKey = new Map(rows.filter((row) => row.isActive).map((row) => [row.key, row.value]));
  const activeCycle =
    normalizeAcademicOfferCycle(rowByKey.get(ACTIVE_CYCLE_KEY)) ?? visibleCycles[0] ?? "C1";

  return {
    activeCycle,
    visibleCycles,
    validCycles: ACADEMIC_OFFER_CYCLES,
    campusVisibles: campuses,
    importerFlags: parseJsonObject(rowByKey.get(IMPORTER_FLAGS_KEY)),
    quoteFlags: parseJsonObject(rowByKey.get(QUOTE_FLAGS_KEY)),
  };
}

async function upsertConfigValue(key: string, value: string, updatedBy: string) {
  await prisma.adminSidebarInfo.upsert({
    where: { key },
    update: { value, isActive: true, updatedBy },
    create: { key, value, isActive: true, updatedBy },
  });
}

export async function GET() {
  const requestId = buildAdminRequestId("admin_config");
  try {
    const auth = await requireAdminApiCapability(
      requestId,
      AdminCapability.view_admin_operations,
    );
    if (!auth.ok) return auth.response;

    return adminApiSuccess(requestId, {
      config: await getConfigState(),
    });
  } catch (error) {
    logAdminApiFailure({
      requestId,
      module: "admin-config",
      action: "get",
      error,
    });
    return adminApiError({
      requestId,
      status: 500,
      errorCode: "ADMIN_CONFIG_GET_FAILED",
      error: "No fue posible cargar configuración administrativa.",
      details: { reason: error instanceof Error ? error.message : String(error) },
      recoverable: true,
    });
  }
}

export async function PATCH(request: Request) {
  const requestId = buildAdminRequestId("admin_config_patch");
  try {
    const auth = await requireAdminApiCapability(requestId, AdminCapability.publish_config);
    if (!auth.ok) return auth.response;

    const before = await getConfigState();
    const body = (await request.json().catch(() => null)) as
      | {
          activeCycle?: unknown;
          visibleCycles?: unknown;
          importerFlags?: unknown;
          quoteFlags?: unknown;
        }
      | null;
    if (!body || typeof body !== "object") {
      return adminApiError({
        requestId,
        status: 400,
        errorCode: "INVALID_JSON",
        error: "El cuerpo JSON no es válido.",
        recoverable: true,
      });
    }

    const writes: Promise<unknown>[] = [];
    const activeCycle =
      body.activeCycle !== undefined
        ? normalizeAcademicOfferCycle(String(body.activeCycle ?? ""))
        : null;
    if (body.activeCycle !== undefined && !activeCycle) {
      return adminApiError({
        requestId,
        status: 400,
        errorCode: "INVALID_ACTIVE_CYCLE",
        error: "El ciclo activo debe ser C1, C2 o C3.",
        recoverable: true,
      });
    }
    if (activeCycle) {
      writes.push(upsertConfigValue(ACTIVE_CYCLE_KEY, activeCycle, auth.admin.email));
    }

    if (body.visibleCycles !== undefined) {
      const visibleCycles = Array.isArray(body.visibleCycles)
        ? body.visibleCycles
            .map((value) => normalizeAcademicOfferCycle(String(value ?? "")))
            .filter((value): value is (typeof ACADEMIC_OFFER_CYCLES)[number] => Boolean(value))
        : [];
      if (!visibleCycles.length) {
        return adminApiError({
          requestId,
          status: 400,
          errorCode: "INVALID_VISIBLE_CYCLES",
          error: "Debes mantener al menos un ciclo visible.",
          recoverable: true,
        });
      }
      writes.push(saveAcademicOfferVisibleCycles(visibleCycles, auth.admin.email));
    }

    if (body.importerFlags !== undefined) {
      const flags = sanitizeFlags(body.importerFlags);
      if (!flags) {
        return adminApiError({
          requestId,
          status: 400,
          errorCode: "INVALID_IMPORTER_FLAGS",
          error: "Los flags de importador deben ser booleanos y seguros.",
          recoverable: true,
        });
      }
      writes.push(upsertConfigValue(IMPORTER_FLAGS_KEY, JSON.stringify(flags), auth.admin.email));
    }

    if (body.quoteFlags !== undefined) {
      const flags = sanitizeFlags(body.quoteFlags);
      if (!flags) {
        return adminApiError({
          requestId,
          status: 400,
          errorCode: "INVALID_QUOTE_FLAGS",
          error: "Los flags de cotizador deben ser booleanos y seguros.",
          recoverable: true,
        });
      }
      writes.push(upsertConfigValue(QUOTE_FLAGS_KEY, JSON.stringify(flags), auth.admin.email));
    }

    await Promise.all(writes);
    const after = await getConfigState();
    await writeAdminAuditLog({
      module: AdminConfigModule.OFFER,
      action: AdminAuditAction.UPDATE,
      actor: auth.admin,
      entityType: "AdminConfig",
      requestId,
      before: toAuditJson(before),
      after: toAuditJson(after),
      diffSummary: {
        updatedKeys: Object.keys(body).filter((key) => body[key as keyof typeof body] !== undefined),
      },
      message: "Configuración administrativa segura actualizada desde API.",
    });

    return adminApiSuccess(requestId, { config: after });
  } catch (error) {
    logAdminApiFailure({
      requestId,
      module: "admin-config",
      action: "patch",
      error,
    });
    return adminApiError({
      requestId,
      status: 500,
      errorCode: "ADMIN_CONFIG_PATCH_FAILED",
      error: "No fue posible actualizar configuración administrativa.",
      details: { reason: error instanceof Error ? error.message : String(error) },
      recoverable: true,
    });
  }
}
