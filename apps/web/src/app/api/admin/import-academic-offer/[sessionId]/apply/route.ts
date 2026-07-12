import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import {
  AdminCapability,
  AdminChangeSource,
  AdminConfigModule,
  AdminImportSessionStatus,
  BusinessEventType,
} from "@prisma/client";

import { requireAdminApiCapability } from "@/lib/api-auth";
import { buildAdminRequestId } from "@/lib/admin-api";
import { getAdminConfigModulePaths } from "@/lib/admin-config-modules";
import { writeBusinessEventSafe } from "@/lib/business-events";
import {
  applyPreparedAcademicOfferImport,
  type PreparedAcademicOfferImportPayload,
} from "@/lib/importers/academic-offer-replace";
import {
  redirectAdminImportPublicationIfNeeded,
  validateAdminImportPublicationConfirmation,
} from "@/lib/importers/admin-import-publication";
import { captureException, logStructured } from "@/lib/observability";
import {
  assertImportSessionCanApply,
  getAdminImportSession,
  markAdminImportSessionApplied,
  markAdminImportSessionFailed,
} from "@/lib/importers/admin-import-sessions";
import {
  getPublicRouteTagsForModule,
  revalidatePublicRouteTags,
} from "@/lib/public-route-cache";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  context: { params: Promise<{ sessionId: string }> },
) {
  const requestId = buildAdminRequestId("admin_academic_offer_import_apply");
  let sessionId: string | null = null;
  let actor: { id: string; email: string } | null = null;
  let sessionMarkedApplied = false;

  try {
    ({ sessionId } = await context.params);

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

    const auth = await requireAdminApiCapability(
      requestId,
      AdminCapability.manage_offers,
    );
    if (!auth.ok) {
      const redirectResponse = redirectAdminImportPublicationIfNeeded(request, sessionId, {
        publicationError: "No tienes permisos para publicar importaciones de oferta académica.",
      });
      if (redirectResponse) return redirectResponse;
      return auth.response;
    }
    const admin = auth.admin;
    actor = admin;

    const session = await getAdminImportSession({ sessionId });

    if (!session || session.module !== AdminConfigModule.OFFER) {
      const redirectResponse = redirectAdminImportPublicationIfNeeded(request, sessionId, {
        publicationError: "No se encontró la sesión de importación de oferta académica.",
      });
      if (redirectResponse) return redirectResponse;
      return NextResponse.json({ ok: false, error: "Sesión no encontrada." }, { status: 404 });
    }

    if (session.status === AdminImportSessionStatus.applied && session.result) {
      const redirectResponse = redirectAdminImportPublicationIfNeeded(request, sessionId);
      if (redirectResponse) return redirectResponse;
      return NextResponse.json({
        ...(session.result as Record<string, unknown>),
        sessionId,
        applied: true,
      });
    }

    const confirmation = await validateAdminImportPublicationConfirmation(request);
    if (!confirmation.ok) {
      const redirectResponse = redirectAdminImportPublicationIfNeeded(request, sessionId, {
        publicationError: confirmation.message,
      });
      if (redirectResponse) return redirectResponse;
      return NextResponse.json(
        { ok: false, error: confirmation.message },
        { status: 400 },
      );
    }

    try {
      assertImportSessionCanApply(session);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "La sesión de importación no se puede aplicar.";
      const redirectResponse = redirectAdminImportPublicationIfNeeded(request, sessionId, {
        publicationError: message,
      });
      if (redirectResponse) return redirectResponse;
      return NextResponse.json(
        {
          ok: false,
          error: message,
        },
        { status: 400 },
      );
    }

    if (!session.payload) {
      const redirectResponse = redirectAdminImportPublicationIfNeeded(request, sessionId, {
        publicationError: "La sesión no tiene payload preparado para aplicar.",
      });
      if (redirectResponse) return redirectResponse;
      return NextResponse.json(
        { ok: false, error: "La sesión no tiene payload preparado para aplicar." },
        { status: 400 },
      );
    }

    const applyMode = new URL(request.url).searchParams.get("mode") === "update-only" ? "update-only" : "replace";
    const summary = await applyPreparedAcademicOfferImport({
      payload: session.payload as unknown as PreparedAcademicOfferImportPayload,
      updatedBy: admin.email,
      mode: applyMode,
    });

    await markAdminImportSessionApplied({
      sessionId,
      module: AdminConfigModule.OFFER,
      actor: admin,
      result: summary,
      requestId,
      source: AdminChangeSource.IMPORT,
    });
    sessionMarkedApplied = true;

    await writeBusinessEventSafe({
      type: BusinessEventType.IMPORT_APPLIED,
      userId: admin.id,
      subjectType: "AdminImportSession",
      subjectId: sessionId,
      metadata: {
        module: AdminConfigModule.OFFER,
        cycle: summary.cycle,
        campusesProcessed: summary.campusesProcessed,
        offerings: summary.offerings,
      },
    });

    logStructured("info", "Academic offer import applied", {
      module: "offer-import",
      action: "apply",
      result: "success",
      actorUserId: admin.id,
      actorEmail: admin.email,
      requestId,
      subjectType: "AdminImportSession",
      subjectId: sessionId,
      metadata: {
        cycle: summary.cycle,
        campusesProcessed: summary.campusesProcessed,
        offerings: summary.offerings,
        replacementMode: applyMode === "replace",
        applyMode,
      },
    });

    try {
      for (const path of getAdminConfigModulePaths(AdminConfigModule.OFFER)) {
        revalidatePath(path);
      }
      revalidatePublicRouteTags(
        getPublicRouteTagsForModule(AdminConfigModule.OFFER),
      );
      revalidatePath("/admin/importaciones");
      revalidatePath(`/admin/importaciones/${sessionId}`);
    } catch (cacheError) {
      captureException(cacheError, {
        module: "offer-import",
        action: "revalidate",
        result: "failure",
        requestId,
        subjectType: "AdminImportSession",
        subjectId: sessionId,
      }, "Academic offer import cache revalidation failed");
    }

    const redirectResponse = redirectAdminImportPublicationIfNeeded(request, sessionId);
    if (redirectResponse) return redirectResponse;

    return NextResponse.json({ ...summary, sessionId, applied: true });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "No fue posible aplicar la sesión.";

    if (sessionId && !sessionMarkedApplied) {
      await markAdminImportSessionFailed({
        sessionId,
        module: AdminConfigModule.OFFER,
        actor,
        errors: [message],
        result: { stage: "apply", message },
        requestId,
        source: AdminChangeSource.IMPORT,
      }).catch(() => undefined);
    }

    captureException(error, {
      module: "offer-import",
      action: "apply",
      result: "failure",
      actorUserId: actor?.id ?? null,
      actorEmail: actor?.email ?? null,
      requestId,
      metadata: { message, sessionId },
    }, "Academic offer import apply failed");

    await writeBusinessEventSafe({
      type: BusinessEventType.IMPORT_FAILED,
      userId: actor?.id ?? null,
      subjectType: "AdminImportSession",
      subjectId: sessionId ?? undefined,
      metadata: {
        module: AdminConfigModule.OFFER,
        stage: "apply",
        message,
      },
    });

    if (sessionId) {
      const redirectResponse = redirectAdminImportPublicationIfNeeded(request, sessionId, {
        publicationError: message,
      });
      if (redirectResponse) return redirectResponse;
    }

    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
