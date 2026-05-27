import { AdminCapability } from "@prisma/client";

import { requireAdminApiCapability } from "@/lib/api-auth";
import {
  adminApiError,
  adminApiSuccess,
  buildAdminRequestId,
  logAdminApiFailure,
} from "@/lib/admin-api";
import { getAdminImportSession } from "@/lib/importers/admin-import-sessions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ sessionId: string }> },
) {
  const requestId = buildAdminRequestId("admin_import_session_detail");
  try {
    const auth = await requireAdminApiCapability(
      requestId,
      AdminCapability.view_admin_operations,
    );
    if (!auth.ok) return auth.response;

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

    return adminApiSuccess(requestId, { session });
  } catch (error) {
    logAdminApiFailure({
      requestId,
      module: "admin-import-sessions",
      action: "get",
      error,
    });
    return adminApiError({
      requestId,
      status: 500,
      errorCode: "IMPORT_SESSION_DETAIL_FAILED",
      error: "No fue posible consultar la sesión de importación.",
    });
  }
}
