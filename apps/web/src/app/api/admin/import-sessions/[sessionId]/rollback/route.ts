import { AdminCapability } from "@prisma/client";

import { requireAdminApiCapability } from "@/lib/api-auth";
import {
  adminApiError,
  adminApiSuccess,
  buildAdminRequestId,
  logAdminApiFailure,
} from "@/lib/admin-api";
import { getAdminImportSession } from "@/lib/importers/admin-import-sessions";
import {
  getAdminImportRollbackCapability,
  rollbackAdminImportSessionToBeforeSnapshot,
} from "@/lib/importers/admin-import-rollbacks";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  _request: Request,
  context: { params: Promise<{ sessionId: string }> },
) {
  const requestId = buildAdminRequestId("admin_import_session_rollback");

  try {
    const operationsAuth = await requireAdminApiCapability(
      requestId,
      AdminCapability.view_admin_operations,
    );
    if (!operationsAuth.ok) return operationsAuth.response;

    const { sessionId } = await context.params;
    const session = await getAdminImportSession({ sessionId });
    if (!session) {
      return adminApiError({
        requestId,
        status: 404,
        errorCode: "IMPORT_SESSION_NOT_FOUND",
        error: "No se encontró la sesión de importación.",
        recoverable: true,
      });
    }

    const rollbackCapability = getAdminImportRollbackCapability(session.module);
    if (!rollbackCapability) {
      return adminApiError({
        requestId,
        status: 400,
        errorCode: "IMPORT_SESSION_ROLLBACK_UNSUPPORTED",
        error: "Esta sesión no soporta rollback operativo.",
        recoverable: true,
      });
    }

    const moduleAuth = await requireAdminApiCapability(
      requestId,
      rollbackCapability,
    );
    if (!moduleAuth.ok) return moduleAuth.response;

    const rolledBackSession = await rollbackAdminImportSessionToBeforeSnapshot({
      sessionId,
      actor: moduleAuth.admin,
      requestId,
    });

    return adminApiSuccess(
      requestId,
      { session: rolledBackSession },
      { message: "Rollback de importación aplicado." },
    );
  } catch (error) {
    logAdminApiFailure({
      requestId,
      module: "admin-import-sessions",
      action: "rollback",
      error,
    });
    return adminApiError({
      requestId,
      status: 500,
      errorCode: "IMPORT_SESSION_ROLLBACK_FAILED",
      error:
        error instanceof Error
          ? error.message
          : "No fue posible revertir la sesión de importación.",
      recoverable: true,
    });
  }
}
