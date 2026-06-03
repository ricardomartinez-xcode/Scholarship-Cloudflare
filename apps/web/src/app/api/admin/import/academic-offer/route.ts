import { AdminAuditAction, AdminCapability, AdminChangeSource, AdminConfigModule } from "@prisma/client";

import { requireAdminApiCapability } from "@/lib/api-auth";
import { writeAdminAuditLog } from "@/lib/admin-audit";
import {
  adminApiError,
  adminApiSuccess,
  buildAdminRequestId,
  logAdminApiFailure,
} from "@/lib/admin-api";
import { resolveAcademicOfferRequestImport } from "@/lib/admin-academic-offer-control";
import {
  importAcademicOfferFromExcel,
  prepareAcademicOfferImport,
} from "@/lib/importers/academic-offer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const requestId = buildAdminRequestId("admin_academic_offer_import");
  try {
    const auth = await requireAdminApiCapability(requestId, AdminCapability.manage_offers);
    if (!auth.ok) return auth.response;

    const resolved = await resolveAcademicOfferRequestImport(request);
    if (!resolved.ok) {
      return adminApiError({
        requestId,
        status: resolved.status,
        errorCode: resolved.errorCode,
        error: resolved.error,
        details: { rowErrors: resolved.rowErrors },
        recoverable: true,
      });
    }

    const prepared = await prepareAcademicOfferImport({
      input: resolved.input,
      cycle: resolved.cycle,
    });

    if (resolved.dryRun) {
      await writeAdminAuditLog({
        module: AdminConfigModule.OFFER,
        action: AdminAuditAction.IMPORT_VALIDATE,
        source: AdminChangeSource.IMPORT,
        actor: auth.admin,
        entityType: "ProgramOffering",
        requestId,
        after: {
          cycle: prepared.summary.cycle,
          fileName: resolved.fileName,
          dryRun: true,
          campusesProcessed: prepared.summary.campusesProcessed,
        },
        diffSummary: prepared.summary,
        message: "Dry-run de importación de oferta académica desde API admin.",
      });

      return adminApiSuccess(requestId, {
        ...prepared.summary,
        dryRun: true,
        fileName: resolved.fileName,
        rowErrors: resolved.rowErrors,
        previewRows: prepared.previewRows,
      });
    }

    const summary = await importAcademicOfferFromExcel({
      input: resolved.input,
      cycle: resolved.cycle,
      updatedBy: auth.admin.email,
    });

    await writeAdminAuditLog({
      module: AdminConfigModule.OFFER,
      action: AdminAuditAction.IMPORT_APPLY,
      source: AdminChangeSource.IMPORT,
      actor: auth.admin,
      entityType: "ProgramOffering",
      requestId,
      after: {
        cycle: summary.cycle,
        fileName: resolved.fileName,
        dryRun: false,
        offerings: summary.offerings,
        campusesProcessed: summary.campusesProcessed,
      },
      diffSummary: summary,
      message: "Importación aplicada de oferta académica desde API admin.",
    });

    return adminApiSuccess(requestId, {
      ...summary,
      dryRun: false,
      fileName: resolved.fileName,
      rowErrors: resolved.rowErrors,
    });
  } catch (error) {
    logAdminApiFailure({
      requestId,
      module: "admin-academic-offer",
      action: "import",
      error,
    });
    return adminApiError({
      requestId,
      status: 500,
      errorCode: "ACADEMIC_OFFER_IMPORT_FAILED",
      error: "No fue posible importar la oferta académica.",
      details: { reason: error instanceof Error ? error.message : String(error) },
      recoverable: true,
    });
  }
}
