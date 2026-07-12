import { revalidatePath } from "next/cache";
import {
  AdminAuditAction,
  AdminCapability,
  AdminChangeSource,
  AdminConfigModule,
} from "@prisma/client";

import { requireAdminApiCapability } from "@/lib/api-auth";
import { writeAdminAuditLog } from "@/lib/admin-audit";
import { getAdminConfigModulePaths } from "@/lib/admin-config-modules";
import {
  adminApiError,
  adminApiSuccess,
  buildAdminRequestId,
  logAdminApiFailure,
} from "@/lib/admin-api";
import { resolveAcademicOfferRequestImport } from "@/lib/admin-academic-offer-control";
import { prepareAcademicOfferImport } from "@/lib/importers/academic-offer";
import { enrichAcademicOfferImportWithModuleSheet } from "@/lib/importers/academic-offer-module-sheet";
import { applyPreparedAcademicOfferImport } from "@/lib/importers/academic-offer-replace";
import {
  getPublicRouteTagsForModule,
  revalidatePublicRouteTags,
} from "@/lib/public-route-cache";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const requestId = buildAdminRequestId("admin_academic_offer_import");
  try {
    const operationsAuth = await requireAdminApiCapability(
      requestId,
      AdminCapability.view_admin_operations,
    );
    if (!operationsAuth.ok) return operationsAuth.response;

    const auth = await requireAdminApiCapability(
      requestId,
      AdminCapability.manage_offers,
    );
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

    let prepared = await prepareAcademicOfferImport({
      input: resolved.input,
      cycle: resolved.cycle,
    });
    prepared = await enrichAcademicOfferImportWithModuleSheet({
      input: resolved.input,
      prepared,
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

    const summary = await applyPreparedAcademicOfferImport({
      payload: prepared.payload,
      updatedBy: auth.admin.email,
      mode: "replace",
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

    try {
      for (const path of getAdminConfigModulePaths(AdminConfigModule.OFFER)) {
        revalidatePath(path);
      }
      revalidatePublicRouteTags(
        getPublicRouteTagsForModule(AdminConfigModule.OFFER),
      );
    } catch (cacheError) {
      logAdminApiFailure({
        requestId,
        module: "admin-academic-offer",
        action: "revalidate",
        error: cacheError,
      });
    }

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
