import { AdminCapability, AdminConfigModule, AdminImportSessionStatus } from "@prisma/client";

import { requireAdminApiCapability } from "@/lib/api-auth";
import {
  adminApiError,
  adminApiSuccess,
  buildAdminRequestId,
  logAdminApiFailure,
} from "@/lib/admin-api";
import { listAdminImportSessions } from "@/lib/importers/admin-import-sessions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function parseAdminConfigModule(value: string | null) {
  if (!value) return null;
  const normalized = value.trim().toUpperCase();
  return Object.values(AdminConfigModule).includes(normalized as AdminConfigModule)
    ? (normalized as AdminConfigModule)
    : null;
}

function parseImportSessionStatus(value: string | null) {
  if (!value) return null;
  const normalized = value.trim().toLowerCase();
  return Object.values(AdminImportSessionStatus).includes(
    normalized as AdminImportSessionStatus,
  )
    ? (normalized as AdminImportSessionStatus)
    : null;
}

function parseLimit(value: string | null) {
  const parsed = Number(value ?? 30);
  if (!Number.isFinite(parsed)) return 30;
  return Math.min(Math.max(Math.trunc(parsed), 1), 100);
}

export async function GET(request: Request) {
  const requestId = buildAdminRequestId("admin_import_sessions_list");
  try {
    const auth = await requireAdminApiCapability(
      requestId,
      AdminCapability.view_admin_operations,
    );
    if (!auth.ok) return auth.response;

    const url = new URL(request.url);
    const moduleRaw = url.searchParams.get("module");
    const statusRaw = url.searchParams.get("status");
    const moduleFilter = parseAdminConfigModule(moduleRaw);
    const status = parseImportSessionStatus(statusRaw);

    if (moduleRaw && !moduleFilter) {
      return adminApiError({
        requestId,
        status: 400,
        errorCode: "INVALID_MODULE",
        error: `Módulo inválido: ${moduleRaw}.`,
        recoverable: true,
      });
    }

    if (statusRaw && !status) {
      return adminApiError({
        requestId,
        status: 400,
        errorCode: "INVALID_IMPORT_STATUS",
        error: `Estatus inválido: ${statusRaw}.`,
        recoverable: true,
      });
    }

    const sessions = await listAdminImportSessions({
      module: moduleFilter,
      status,
      limit: parseLimit(url.searchParams.get("limit")),
    });

    return adminApiSuccess(requestId, { sessions });
  } catch (error) {
    logAdminApiFailure({
      requestId,
      module: "admin-import-sessions",
      action: "list",
      error,
    });
    return adminApiError({
      requestId,
      status: 500,
      errorCode: "IMPORT_SESSIONS_LIST_FAILED",
      error: "No fue posible listar las sesiones de importación.",
    });
  }
}
