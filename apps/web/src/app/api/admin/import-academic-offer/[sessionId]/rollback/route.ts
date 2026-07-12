import {
  AdminCapability,
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
  getAdminImportSession,
} from "@/lib/importers/admin-import-sessions";
import {
  rollbackAdminImportSessionToBeforeSnapshot,
} from "@/lib/importers/admin-import-rollbacks";
import { logStructured } from "@/lib/observability";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  _request: Request,
  context: { params: Promise<{ sessionId: string }> },
) {
  const requestId = buildAdminRequestId("admin_academic_offer_import_rollback");

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

    const { sessionId } = await context.params;
    const session = await getAdminImportSession({ sessionId });
    if (!session || session.module !== AdminConfigModule.OFFER) {
      return adminApiError({
        requestId,
        status: 404,
        errorCode: "OFFER_IMPORT_SESSION_NOT_FOUND",
        error: "No se encontró la sesión de importación de oferta académica.",
        recoverable: true,
      });
    }

    if (session.status === AdminImportSessionStatus.rolled_back) {
      return adminApiSuccess(requestId, {
        session,
        sessionId,
        rolledBack: true,
      });
    }

    const rolledBackSession = await rollbackAdminImportSessionToBeforeSnapshot({
      sessionId,
      actor: auth.admin,
      requestId,
    });

    await writeBusinessEventSafe({
      type: BusinessEventType.IMPORT_ROLLED_BACK,
      userId: auth.admin.id,
      subjectType: "AdminImportSession",
      subjectId: sessionId,
      metadata: {
        module: AdminConfigModule.OFFER,
        status: AdminImportSessionStatus.rolled_back,
      },
    });

    logStructured("info", "Academic offer import rolled back", {
      module: "offer-import",
      action: "rollback",
      result: "success",
      requestId,
      actorUserId: auth.admin.id,
      actorEmail: auth.admin.email,
      subjectType: "AdminImportSession",
      subjectId: sessionId,
    });

    return adminApiSuccess(
      requestId,
      { session: rolledBackSession, sessionId, rolledBack: true },
      { message: "Rollback de oferta académica aplicado." },
    );
  } catch (error) {
    logAdminApiFailure({
      requestId,
      module: "admin-academic-offer-import",
      action: "rollback",
      error,
    });
    return adminApiError({
      requestId,
      status: 500,
      errorCode: "OFFER_IMPORT_ROLLBACK_FAILED",
      error:
        error instanceof Error
          ? error.message
          : "No fue posible revertir la sesión de importación.",
      recoverable: true,
    });
  }
}
