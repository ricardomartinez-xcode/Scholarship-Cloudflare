import { NextResponse } from "next/server";
import {
  AdminChangeSource,
  AdminConfigModule,
  AdminImportSessionStatus,
  BusinessEventType,
} from "@prisma/client";

import { getAdminUser } from "@/lib/admin-session";
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

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  context: { params: Promise<{ sessionId: string }> },
) {
  let sessionId: string | null = null;

  try {
    ({ sessionId } = await context.params);

    const admin = await getAdminUser();
    if (!admin) {
      const redirectResponse = redirectAdminImportPublicationIfNeeded(request, sessionId, {
        publicationError: "No tienes una sesión administrativa activa para publicar esta importación.",
      });
      if (redirectResponse) return redirectResponse;
      return NextResponse.json({ ok: false, error: "No autorizado." }, { status: 401 });
    }

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

    const summary = await applyPreparedAcademicOfferImport({
      payload: session.payload as unknown as PreparedAcademicOfferImportPayload,
      updatedBy: admin.email,
    });

    await markAdminImportSessionApplied({
      sessionId,
      module: AdminConfigModule.OFFER,
      actor: admin,
      result: summary,
      requestId: null,
      source: AdminChangeSource.IMPORT,
    });

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
      subjectType: "AdminImportSession",
      subjectId: sessionId,
      metadata: {
        cycle: summary.cycle,
        campusesProcessed: summary.campusesProcessed,
        offerings: summary.offerings,
        replacementMode: true,
      },
    });

    const redirectResponse = redirectAdminImportPublicationIfNeeded(request, sessionId);
    if (redirectResponse) return redirectResponse;

    return NextResponse.json({ ...summary, sessionId, applied: true });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "No fue posible aplicar la sesión.";
    const admin = await getAdminUser().catch(() => null);

    if (sessionId) {
      await markAdminImportSessionFailed({
        sessionId,
        module: AdminConfigModule.OFFER,
        actor: admin,
        errors: [message],
        result: { stage: "apply", message },
        requestId: null,
        source: AdminChangeSource.IMPORT,
      }).catch(() => undefined);
    }

    captureException(error, {
      module: "offer-import",
      action: "apply",
      result: "failure",
      actorUserId: admin?.id ?? null,
      actorEmail: admin?.email ?? null,
      metadata: { message, sessionId },
    }, "Academic offer import apply failed");

    await writeBusinessEventSafe({
      type: BusinessEventType.IMPORT_FAILED,
      userId: admin?.id ?? null,
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
