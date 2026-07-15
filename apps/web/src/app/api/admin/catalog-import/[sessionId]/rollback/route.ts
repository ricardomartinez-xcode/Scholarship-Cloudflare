import { AdminCapability, AdminConfigModule, AdminImportSessionStatus } from "@prisma/client";

import { requireAdminApiCapability } from "@/lib/api-auth";
import { adminApiError, adminApiSuccess, buildAdminRequestId, logAdminApiFailure } from "@/lib/admin-api";
import { restoreCampusesSnapshot, restoreOrganizationsSnapshot, type CampusCatalogSnapshot, type CampusImportPayload, type OrganizationCatalogSnapshot, type OrganizationImportPayload } from "@/lib/importers/catalog-csv";
import { getAdminImportSession, markAdminImportSessionRolledBack } from "@/lib/importers/admin-import-sessions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(_request: Request, context: { params: Promise<{ sessionId: string }> }) {
  const requestId = buildAdminRequestId("admin_catalog_import_rollback");
  try {
    const operations = await requireAdminApiCapability(requestId, AdminCapability.view_admin_operations); if (!operations.ok) return operations.response;
    const { sessionId } = await context.params; const session = await getAdminImportSession({ sessionId });
    if (!session) return adminApiError({ requestId, status: 404, errorCode: "SESSION_NOT_FOUND", error: "Sesión no encontrada.", recoverable: true });
    if (session.status !== AdminImportSessionStatus.applied || !session.beforeSnapshot || !session.payload) return adminApiError({ requestId, status: 400, errorCode: "ROLLBACK_NOT_AVAILABLE", error: "La sesión no tiene un snapshot elegible para rollback.", recoverable: true });
    if (session.module === AdminConfigModule.ACCESS && session.fileName?.startsWith("organizations:")) {
      const auth = await requireAdminApiCapability(requestId, AdminCapability.manage_org_members); if (!auth.ok) return auth.response;
      await restoreOrganizationsSnapshot(session.beforeSnapshot as unknown as OrganizationCatalogSnapshot, session.payload as unknown as OrganizationImportPayload);
      const rolledBack = await markAdminImportSessionRolledBack({ sessionId, module: AdminConfigModule.ACCESS, actor: auth.admin, requestId, result: { rollback: true, catalog: "organizations" } });
      return adminApiSuccess(requestId, { session: rolledBack }, { message: "Rollback de organizaciones aplicado." });
    }
    if (session.module === AdminConfigModule.OFFER && session.fileName?.startsWith("campuses:")) {
      const auth = await requireAdminApiCapability(requestId, AdminCapability.manage_directory); if (!auth.ok) return auth.response;
      await restoreCampusesSnapshot(session.beforeSnapshot as unknown as CampusCatalogSnapshot, session.payload as unknown as CampusImportPayload);
      const rolledBack = await markAdminImportSessionRolledBack({ sessionId, module: AdminConfigModule.OFFER, actor: auth.admin, requestId, result: { rollback: true, catalog: "campuses" } });
      return adminApiSuccess(requestId, { session: rolledBack }, { message: "Rollback de planteles aplicado." });
    }
    return adminApiError({ requestId, status: 400, errorCode: "UNSUPPORTED_CATALOG_SESSION", error: "Esta sesión no pertenece a un importador de catálogo compatible.", recoverable: true });
  } catch (error) {
    logAdminApiFailure({ requestId, module: "admin-catalog-import", action: "rollback", error });
    return adminApiError({ requestId, status: 500, errorCode: "CATALOG_IMPORT_ROLLBACK_FAILED", error: error instanceof Error ? error.message : "No fue posible revertir la importación.", recoverable: true });
  }
}
