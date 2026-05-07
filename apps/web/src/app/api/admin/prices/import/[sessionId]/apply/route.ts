import { revalidatePath } from "next/cache";
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
import { captureDraftConfigSnapshot } from "@/lib/admin-config-snapshots";
import { writeBusinessEventSafe } from "@/lib/business-events";
import {
  applyPreparedPricesImport,
  type PreparedPricesImportPayload,
} from "@/lib/importers/prices-csv";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  _request: Request,
  context: { params: Promise<{ sessionId: string }> },
) {
  const requestId = buildAdminRequestId("admin_prices_import_apply");
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
        payload: true,
        errors: true,
        result: true,
      },
    });
    if (!session) {
      return adminApiError({
        requestId,
        status: 404,
        errorCode: "SESSION_NOT_FOUND",
        error: "No se encontró la sesión de importación de precios.",
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

    const validationErrors = Array.isArray(session.errors)
      ? session.errors.map((item) => String(item))
      : [];
    if (validationErrors.length) {
      return adminApiError({
        requestId,
        status: 400,
        errorCode: "SESSION_HAS_ERRORS",
        error: "La sesión contiene errores de validación. Corrige el CSV antes de aplicar.",
        details: { errors: validationErrors },
        recoverable: true,
      });
    }

    const beforeSnapshot = await captureDraftConfigSnapshot(AdminConfigModule.PRICES);
    const summary = await applyPreparedPricesImport({
      payload: session.payload as PreparedPricesImportPayload,
      updatedBy: auth.admin.email,
    });
    const afterSnapshot = await captureDraftConfigSnapshot(AdminConfigModule.PRICES);

    await prisma.adminImportSession.update({
      where: { id: sessionId },
      data: {
        status: AdminImportSessionStatus.applied,
        beforeSnapshot: beforeSnapshot as Prisma.InputJsonValue,
        afterSnapshot: afterSnapshot as Prisma.InputJsonValue,
        result: summary as Prisma.InputJsonValue,
        appliedAt: new Date(),
        appliedByUserId: auth.admin.id,
        appliedByEmail: auth.admin.email,
      },
    });

    await writeAdminAuditLog({
      module: AdminConfigModule.PRICES,
      action: AdminAuditAction.IMPORT_APPLY,
      source: AdminChangeSource.IMPORT,
      actor: auth.admin,
      entityType: "AdminImportSession",
      entityId: sessionId,
      after: summary,
      importSessionId: sessionId,
    });

    await writeBusinessEventSafe({
      type: BusinessEventType.IMPORT_APPLIED,
      userId: auth.admin.id,
      subjectType: "AdminImportSession",
      subjectId: sessionId,
      metadata: {
        module: AdminConfigModule.PRICES,
        ...summary,
      },
    });

    revalidatePath("/admin/prices");
    revalidatePath("/");
    revalidatePath("/unidep");

    return adminApiSuccess(
      requestId,
      { sessionId, applied: true, ...summary },
      { message: "Importación de precios aplicada." },
    );
  } catch (error) {
    logAdminApiFailure({
      requestId,
      module: "admin-prices-import",
      action: "apply",
      error,
    });
    return adminApiError({
      requestId,
      status: 500,
      errorCode: "PRICES_IMPORT_APPLY_FAILED",
      error:
        error instanceof Error
          ? error.message
          : "No fue posible aplicar la sesión de importación de precios.",
      recoverable: true,
    });
  }
}
