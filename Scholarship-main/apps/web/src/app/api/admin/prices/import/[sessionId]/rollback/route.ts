import { revalidatePath } from "next/cache";
import {
  AdminAuditAction,
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
import { writeAdminAuditLog } from "@/lib/admin-audit";
import { restoreDraftConfigSnapshot } from "@/lib/admin-config-snapshots";
import { writeBusinessEventSafe } from "@/lib/business-events";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  _request: Request,
  context: { params: Promise<{ sessionId: string }> },
) {
  const requestId = buildAdminRequestId("admin_prices_import_rollback");
  try {
    const operationsAuth = await requireAdminApiCapability(
      requestId,
      AdminCapability.view_admin_operations,
    );
    if (!operationsAuth.ok) return operationsAuth.response;

    const auth = await requireAdminApiCapability(requestId, AdminCapability.manage_prices);
    if (!auth.ok) return auth.response;

    const { sessionId } = await context.params;
    const session = await prisma.adminImportSession.findFirst({
      where: { id: sessionId, module: AdminConfigModule.PRICES },
      select: {
        id: true,
        status: true,
        beforeSnapshot: true,
      },
    });
    if (!session || !session.beforeSnapshot) {
      return adminApiError({
        requestId,
        status: 404,
        errorCode: "ROLLBACK_NOT_AVAILABLE",
        error: "La sesión no tiene rollback disponible.",
        recoverable: true,
      });
    }

    if (session.status === AdminImportSessionStatus.rolled_back) {
      return adminApiSuccess(requestId, { sessionId, rolledBack: true });
    }

    await restoreDraftConfigSnapshot(
      AdminConfigModule.PRICES,
      session.beforeSnapshot as never,
    );

    await prisma.adminImportSession.update({
      where: { id: sessionId },
      data: {
        status: AdminImportSessionStatus.rolled_back,
        rolledBackAt: new Date(),
      },
    });

    await writeAdminAuditLog({
      module: AdminConfigModule.PRICES,
      action: AdminAuditAction.IMPORT_ROLLBACK,
      source: AdminChangeSource.IMPORT,
      actor: auth.admin,
      entityType: "AdminImportSession",
      entityId: sessionId,
      message: "Rollback lógico del draft de precios.",
      importSessionId: sessionId,
    });

    await writeBusinessEventSafe({
      type: BusinessEventType.IMPORT_ROLLED_BACK,
      userId: auth.admin.id,
      subjectType: "AdminImportSession",
      subjectId: sessionId,
      metadata: {
        module: AdminConfigModule.PRICES,
        status: AdminImportSessionStatus.rolled_back,
      },
    });

    revalidatePath("/admin/prices");
    revalidatePath("/");
    revalidatePath("/unidep");

    return adminApiSuccess(
      requestId,
      { sessionId, rolledBack: true },
      { message: "Rollback de importación de precios ejecutado." },
    );
  } catch (error) {
    logAdminApiFailure({
      requestId,
      module: "admin-prices-import",
      action: "rollback",
      error,
    });
    return adminApiError({
      requestId,
      status: 500,
      errorCode: "PRICES_IMPORT_ROLLBACK_FAILED",
      error:
        error instanceof Error
          ? error.message
          : "No fue posible revertir la sesión de importación de precios.",
      recoverable: true,
    });
  }
}
