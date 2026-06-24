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
  applyPreparedPricesImport,
  type PreparedPricesImportPayload,
} from "@/lib/importers/prices-csv";
import { PriceImportCoverageError } from "@/lib/importers/price-import-integrity-guard";
import {
  redirectAdminImportPublicationIfNeeded,
  validateAdminImportPublicationConfirmation,
} from "@/lib/importers/admin-import-publication";
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
  const requestId = buildAdminRequestId("admin_prices_import_apply");
  let sessionIdForRedirect: string | null = null;

  try {
    const { sessionId } = await context.params;
    sessionIdForRedirect = sessionId;

    const operationsAuth = await requireAdminApiCapability(
      requestId,
      AdminCapability.view_admin_operations,
    );
    if (!operationsAuth.ok) {
      const redirectResponse = redirectAdminImportPublicationIfNeeded(request, sessionId, {
        publicationError: "No tienes permisos administrativos activos para publicar esta importación.",
      });
      if (redirectResponse) return redirectResponse;
      return operationsAuth.response;
    }

    const auth = await requireAdminApiCapability(requestId, AdminCapability.manage_prices);
    if (!auth.ok) {
      const redirectResponse = redirectAdminImportPublicationIfNeeded(request, sessionId, {
        publicationError: "No tienes permisos para publicar importaciones de precios.",
      });
      if (redirectResponse) return redirectResponse;
      return auth.response;
    }

    const session = await getAdminImportSession({ sessionId });

    if (!session || session.module !== AdminConfigModule.PRICES) {
      const redirectResponse = redirectAdminImportPublicationIfNeeded(request, sessionId, {
        publicationError: "No se encontró la sesión de importación de precios.",
      });
      if (redirectResponse) return redirectResponse;
      return adminApiError({
        requestId,
        status: 404,
        errorCode: "SESSION_NOT_FOUND",
        error: "No se encontró la sesión de importación de precios.",
        recoverable: true,
      });
    }

    if (session.status === AdminImportSessionStatus.applied && session.result) {
      const redirectResponse = redirectAdminImportPublicationIfNeeded(request, sessionId);
      if (redirectResponse) return redirectResponse;
      return adminApiSuccess(requestId, {
        sessionId,
        applied: true,
        ...(session.result as Record<string, unknown>),
      });
    }

    const confirmation = await validateAdminImportPublicationConfirmation(request);
    if (!confirmation.ok) {
      const redirectResponse = redirectAdminImportPublicationIfNeeded(request, sessionId, {
        publicationError: confirmation.message,
      });
      if (redirectResponse) return redirectResponse;
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
      const errorMessage =
        error instanceof Error
          ? error.message
          : "La sesión de importación no se puede aplicar.";
      const redirectResponse = redirectAdminImportPublicationIfNeeded(request, sessionId, {
        publicationError: errorMessage,
      });
      if (redirectResponse) return redirectResponse;
      return adminApiError({
        requestId,
        status: 400,
        errorCode: "SESSION_NOT_APPLICABLE",
        error: errorMessage,
        recoverable: true,
      });
    }

    if (!session.payload) {
      const redirectResponse = redirectAdminImportPublicationIfNeeded(request, sessionId, {
        publicationError: "La sesión no tiene payload preparado para aplicar.",
      });
      if (redirectResponse) return redirectResponse;
      return adminApiError({
        requestId,
        status: 400,
        errorCode: "SESSION_PAYLOAD_MISSING",
        error: "La sesión no tiene payload preparado para aplicar.",
        recoverable: true,
      });
    }

    const applyMode = new URL(request.url).searchParams.get("mode") === "update-only" ? "update-only" : "replace";
    const summary = await applyPreparedPricesImport({
      payload: session.payload as PreparedPricesImportPayload,
      updatedBy: auth.admin.email,
      mode: applyMode,
    });

    await markAdminImportSessionApplied({
      sessionId,
      module: AdminConfigModule.PRICES,
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
        module: AdminConfigModule.PRICES,
        ...summary,
      },
    });

    revalidatePath("/admin/precios");
    revalidatePath("/");
    revalidatePath("/unidep");

    const redirectResponse = redirectAdminImportPublicationIfNeeded(request, sessionId);
    if (redirectResponse) return redirectResponse;

    return adminApiSuccess(
      requestId,
      { sessionId, applied: true, ...summary },
      { message: "Importación de precios aplicada." },
    );
  } catch (error) {
    if (error instanceof PriceImportCoverageError) {
      if (sessionIdForRedirect) {
        const redirectResponse = redirectAdminImportPublicationIfNeeded(request, sessionIdForRedirect, {
          publicationError: error.message,
        });
        if (redirectResponse) return redirectResponse;
      }

      return adminApiError({
        requestId,
        status: error.status,
        errorCode: error.code,
        error: error.message,
        details: error.details,
        recoverable: true,
      });
    }

    if (sessionIdForRedirect) {
      const redirectResponse = redirectAdminImportPublicationIfNeeded(request, sessionIdForRedirect, {
        publicationError:
          error instanceof Error
            ? error.message
            : "No fue posible aplicar la sesión de importación de precios.",
      });
      if (redirectResponse) return redirectResponse;
    }

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
