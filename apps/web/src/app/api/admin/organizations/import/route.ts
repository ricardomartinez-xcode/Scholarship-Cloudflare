import { AdminCapability, AdminChangeSource, AdminConfigModule } from "@prisma/client";

import { requireAdminApiCapability } from "@/lib/api-auth";
import { adminApiError, adminApiSuccess, buildAdminRequestId, logAdminApiFailure } from "@/lib/admin-api";
import { captureOrganizationsSnapshot, prepareOrganizationsCsvImport } from "@/lib/importers/catalog-csv";
import { createAdminImportPreviewSession, createImportFileChecksum } from "@/lib/importers/admin-import-sessions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const requestId = buildAdminRequestId("admin_organizations_import");
  try {
    const operations = await requireAdminApiCapability(requestId, AdminCapability.view_admin_operations);
    if (!operations.ok) return operations.response;
    const auth = await requireAdminApiCapability(requestId, AdminCapability.manage_org_members);
    if (!auth.ok) return auth.response;
    const form = await request.formData(); const file = form.get("file");
    if (!(file instanceof File) || file.size <= 0) return adminApiError({ requestId, status: 400, errorCode: "MISSING_FILE", error: "Debes subir un CSV de organizaciones.", recoverable: true });
    if (!file.name.toLowerCase().endsWith(".csv")) return adminApiError({ requestId, status: 400, errorCode: "INVALID_FILE_TYPE", error: "Formato no soportado. Usa CSV.", recoverable: true });
    const text = await file.text(); const prepared = await prepareOrganizationsCsvImport(new File([text], file.name, { type: file.type })); const beforeSnapshot = await captureOrganizationsSnapshot();
    const session = await createAdminImportPreviewSession({ module: AdminConfigModule.ACCESS, actor: auth.admin, kind: "organizations", fileName: `organizations:${file.name}`, fileChecksum: createImportFileChecksum(text), preview: prepared.previewRows, payload: prepared.payload, warnings: prepared.summary.warnings, errors: prepared.summary.errors, summary: prepared.summary, beforeSnapshot: beforeSnapshot as never, captureBeforeSnapshot: false, source: AdminChangeSource.IMPORT, requestId });
    return adminApiSuccess(requestId, { sessionId: session.id, ...prepared.summary, previewRows: prepared.previewRows }, { message: "Importación de organizaciones validada." });
  } catch (error) {
    logAdminApiFailure({ requestId, module: "admin-organizations-import", action: "validate", error });
    return adminApiError({ requestId, status: 500, errorCode: "ORGANIZATIONS_IMPORT_VALIDATE_FAILED", error: error instanceof Error ? error.message : "No fue posible validar organizaciones.", recoverable: true });
  }
}
