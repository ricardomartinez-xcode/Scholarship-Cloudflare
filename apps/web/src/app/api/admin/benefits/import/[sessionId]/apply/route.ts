import { revalidatePath } from "next/cache";
import {
  AdminCapability,
  AdminChangeSource,
  AdminConfigModule,
  AdminImportSessionStatus,
  BusinessEventType,
} from "@prisma/client";

import { requireAdminApiCapability } from "@/lib/api-auth";
import {
  adminApiError,
  adminApiSuccess,
  buildAdminRequestId,
  logAdminApiFailure,
} from "@/lib/admin-api";
import { writeBusinessEventSafe } from "@/lib/business-events";
import {
  applyPreparedBenefitsImport,
  type PreparedBenefitsImportPayload,
} from "@/lib/importers/benefits-csv";
import { validateAdminImportPublicationConfirmation } from "@/lib/importers/admin-import-publication";
import {
  assertImportSessionCanApply,
  getAdminImportSession,
  markAdminImportSessionApplied,
} from "@/lib/importers/admin-import-sessions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  context: { params: Promise<{ sessionId: string }> },
) {
  const requestId = buildAdminRequestId("admin_benefits_import_apply");

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

    const { sessionId } = await context.params;
    const session = await getAdminImportSession({ sessionId });

    if (!session || session.module !== AdminConfigModule.BENEFITS) {
      return adminApiError({
        requestId,
        status: 404,
        errorCode: "SESSION_NOT_FOUND",
        error: "No se encontró la sesión de importación de beneficios.",
        recoverable: true,
      });
    }

    if (session.status === AdminImportSessionStatus.applied && session.result) {
      return adminApiSuccess(requestId, {
        sessionId,
        applied: true,
        ...(session.result as Record<string, unknown>),
      });
    }

    const confirmation = await validateAdminImportPublicationConfirmation(request);
    if (!confirmation.ok) {
      return adminApiError({
        requestId,
        status: 400,
        errorCode: "IMPORT_PUBLICATION_CONFIRMATION_REQUIRED",
        error: confirmation.message,
        recoverable: true,
      });
    }

    try {
      assertImportSessionCanApply(session);
    } catch (error) {
      return adminApiError({
        requestId,
        status: 400,
        errorCode: "SESSION_NOT_APPLICABLE",
        error:
          error instanceof Error
            ? error.message
            : "La sesión de importación no se puede aplicar.",
        recoverable: true,
      });
    }

    if (!session.payload) {
      return adminApiError({
        requestId,
        status: 400,
        errorCode: "SESSION_PAYLOAD_MISSING",
        error: "La sesión no tiene payload preparado para aplicar.",
        recoverable: true,
      });
    }

    const summary = await applyPreparedBenefitsImport({
      payload: session.payload as PreparedBenefitsImportPayload,
      updatedBy: auth.admin.email,
    });

    await markAdminImportSessionApplied({
      sessionId,
      module: AdminConfigModule.BENEFITS,
      actor: auth.admin,
      result: summary,
      requestId,
      source: AdminChangeSource.IMPORT,
    });

    await writeBusinessEventSafe({
      type: BusinessEventType.IMPORT_APPLIED,
      userId: auth.admin.id,
      subjectType: "AdminImportSession",
      subjectId: sessionId,
      metadata: {
        module: AdminConfigModule.BENEFITS,
        ...summary,
      },
    });

    revalidatePath("/admin/benefits");
    revalidatePath("/");
    revalidatePath("/unidep");

    return adminApiSuccess(
      requestId,
      { sessionId, applied: true, ...summary },
      { message: "Importación de beneficios aplicada." },
    );
  } catch (error) {
    logAdminApiFailure({
      requestId,
      module: "admin-benefits-import",
      action: "apply",
      error,
    });

    return adminApiError({
      requestId,
      status: 500,
      errorCode: "BENEFITS_IMPORT_APPLY_FAILED",
      error:
        error instanceof Error
          ? error.message
          : "No fue posible aplicar la sesión de importación de beneficios.",
      recoverable: true,
    });
  }
}
