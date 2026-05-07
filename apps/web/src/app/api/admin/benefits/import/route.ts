import {
  AdminAuditAction,
  AdminCapability,
  AdminChangeSource,
  AdminConfigModule,
  AdminImportSessionStatus,
  BusinessEventType,
  Prisma,
} from "@prisma/client";

import { requireAdminApiCapability } from "@/lib/api-auth";
import {
  adminApiError,
  adminApiSuccess,
  buildAdminRequestId,
  logAdminApiFailure,
} from "@/lib/admin-api";
import { writeAdminAuditLog } from "@/lib/admin-audit";
import { writeBusinessEventSafe } from "@/lib/business-events";
import { prepareBenefitsCsvImport } from "@/lib/importers/benefits-csv";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const requestId = buildAdminRequestId("admin_benefits_import");
  try {
    const operationsAuth = await requireAdminApiCapability(
      requestId,
      AdminCapability.view_admin_operations,
    );
    if (!operationsAuth.ok) return operationsAuth.response;

    const auth = await requireAdminApiCapability(
      requestId,
      AdminCapability.manage_benefits,
    );
    if (!auth.ok) return auth.response;

    const form = await request.formData();
    const maybeFile = form.get("file");
    if (!(maybeFile instanceof File) || maybeFile.size <= 0) {
      return adminApiError({
        requestId,
        status: 400,
        errorCode: "MISSING_FILE",
        error: "Debes subir un archivo CSV para importar beneficios.",
        recoverable: true,
      });
    }
    if (!maybeFile.name.toLowerCase().endsWith(".csv")) {
      return adminApiError({
        requestId,
        status: 400,
        errorCode: "INVALID_FILE_TYPE",
        error: "Formato no soportado. Usa un archivo .csv.",
        recoverable: true,
      });
    }

    const prepared = await prepareBenefitsCsvImport({ file: maybeFile });
    const session = await prisma.adminImportSession.create({
      data: {
        module: AdminConfigModule.BENEFITS,
        status: AdminImportSessionStatus.preview,
        source: AdminChangeSource.IMPORT,
        fileName: maybeFile.name,
        preview: prepared.previewRows as Prisma.InputJsonValue,
        payload: prepared.payload as Prisma.InputJsonValue,
        warnings: prepared.summary.warnings as Prisma.InputJsonValue,
        errors: prepared.summary.errors as Prisma.InputJsonValue,
        summary: prepared.summary as Prisma.InputJsonValue,
        createdByUserId: auth.admin.id,
        createdByEmail: auth.admin.email,
      },
      select: { id: true },
    });

    await writeAdminAuditLog({
      module: AdminConfigModule.BENEFITS,
      action: AdminAuditAction.IMPORT_VALIDATE,
      source: AdminChangeSource.IMPORT,
      actor: auth.admin,
      entityType: "AdminImportSession",
      entityId: session.id,
      after: prepared.summary,
      importSessionId: session.id,
    });

    await writeBusinessEventSafe({
      type: BusinessEventType.IMPORT_VALIDATED,
      userId: auth.admin.id,
      subjectType: "AdminImportSession",
      subjectId: session.id,
      metadata: {
        module: AdminConfigModule.BENEFITS,
        fileName: maybeFile.name,
        processed: prepared.summary.processed,
        ready: prepared.summary.ready,
        warnings: prepared.summary.warnings.length,
        errors: prepared.summary.errors.length,
      },
    });

    return adminApiSuccess(
      requestId,
      {
        sessionId: session.id,
        ...prepared.summary,
        previewRows: prepared.previewRows,
      },
      { message: "Importación de beneficios validada." },
    );
  } catch (error) {
    logAdminApiFailure({
      requestId,
      module: "admin-benefits-import",
      action: "validate",
      error,
    });
    return adminApiError({
      requestId,
      status: 500,
      errorCode: "BENEFITS_IMPORT_VALIDATE_FAILED",
      error:
        error instanceof Error
          ? error.message
          : "No fue posible validar el CSV de beneficios.",
      recoverable: true,
    });
  }
}
