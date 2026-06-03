import { AdminCapability } from "@prisma/client";

import { requireAdminApiCapability } from "@/lib/api-auth";
import {
  adminApiError,
  adminApiSuccess,
  buildAdminRequestId,
  logAdminApiFailure,
} from "@/lib/admin-api";
import { getImporterStatus } from "@/lib/admin-system-control";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const requestId = buildAdminRequestId("admin_importer_status");
  try {
    const auth = await requireAdminApiCapability(
      requestId,
      AdminCapability.view_admin_operations,
    );
    if (!auth.ok) return auth.response;

    return adminApiSuccess(requestId, await getImporterStatus());
  } catch (error) {
    logAdminApiFailure({ requestId, module: "admin-system", action: "importer-status", error });
    return adminApiError({
      requestId,
      status: 500,
      errorCode: "IMPORTER_STATUS_FAILED",
      error: "No fue posible cargar estado del importador.",
      details: { reason: error instanceof Error ? error.message : String(error) },
      recoverable: true,
    });
  }
}
