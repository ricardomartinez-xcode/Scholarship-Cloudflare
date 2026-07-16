import { AdminCapability, AdminChangeSource, AdminConfigModule, AdminImportSessionStatus } from "@prisma/client";

import { requireAdminApiCapability } from "@/lib/api-auth";
import { adminApiError, adminApiSuccess, buildAdminRequestId, logAdminApiFailure } from "@/lib/admin-api";
import { applyCampusesImport, captureCampusesSnapshot, type CampusImportPayload } from "@/lib/importers/catalog-csv";
import { validateAdminImportPublicationConfirmation } from "@/lib/importers/admin-import-publication";
import { assertImportSessionCanApply, getAdminImportSession, markAdminImportSessionApplied } from "@/lib/importers/admin-import-sessions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request, context: { params: Promise<{ sessionId: string }> }) {
  const requestId = buildAdminRequestId("admin_campuses_import_apply");
  try {
    const operations = await requireAdminApiCapability(requestId, AdminCapability.view_admin_operations); if (!operations.ok) return operations.response;
    const auth = await requireAdminApiCapability(requestId, AdminCapability.manage_directory); if (!auth.ok) return auth.response;
    const { sessionId } = await context.params; const session = await getAdminImportSession({ sessionId });
    if (!session || session.module !== AdminConfigModule.DIRECTORY || !session.fileName?.startsWith("campuses:")) return adminApiError({ requestId, status: 404, errorCode: "SESSION_NOT_FOUND", error: "Sesión de planteles no encontrada.", recoverable: true });
    if (session.status === AdminImportSessionStatus.applied && session.result) return adminApiSuccess(requestId, { sessionId, applied: true, ...(session.result as Record<string, unknown>) });
    const confirmation = await validateAdminImportPublicationConfirmation(request); if (!confirmation.ok) return adminApiError({ requestId, status: 400, errorCode: "CONFIRMATION_REQUIRED", error: confirmation.message, recoverable: true });
    assertImportSessionCanApply(session); if (!session.payload) throw new Error("La sesión no tiene payload preparado.");
    const summary = await applyCampusesImport(session.payload as unknown as CampusImportPayload); const afterSnapshot = await captureCampusesSnapshot();
    await markAdminImportSessionApplied({ sessionId, module: AdminConfigModule.DIRECTORY, actor: auth.admin, result: summary, afterSnapshot: afterSnapshot as never, captureAfterSnapshot: false, source: AdminChangeSource.IMPORT, requestId });
    return adminApiSuccess(requestId, { sessionId, applied: true, ...summary }, { message: "Importación de planteles aplicada." });
  } catch (error) {
    logAdminApiFailure({ requestId, module: "admin-campuses-import", action: "apply", error });
    return adminApiError({ requestId, status: 500, errorCode: "CAMPUSES_IMPORT_APPLY_FAILED", error: error instanceof Error ? error.message : "No fue posible aplicar planteles.", recoverable: true });
  }
}
