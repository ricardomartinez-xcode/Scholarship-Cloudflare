import { NextResponse } from "next/server";
import {
  AdminAuditAction,
  AdminChangeSource,
  AdminConfigModule,
  AdminImportSessionStatus,
  BusinessEventType,
  Prisma,
} from "@prisma/client";

import { getAdminUser } from "@/lib/admin-session";
import { writeAdminAuditLog } from "@/lib/admin-audit";
import { captureDraftConfigSnapshot } from "@/lib/admin-config-snapshots";
import { writeBusinessEventSafe } from "@/lib/business-events";
import {
  applyPreparedAcademicOfferImport,
  type PreparedAcademicOfferImportPayload,
} from "@/lib/importers/academic-offer";
import { captureException, logStructured } from "@/lib/observability";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  _request: Request,
  context: { params: Promise<{ sessionId: string }> },
) {
  try {
    const admin = await getAdminUser();
    if (!admin) {
      return NextResponse.json({ ok: false, error: "No autorizado." }, { status: 401 });
    }

    const { sessionId } = await context.params;
    const session = await prisma.adminImportSession.findFirst({
      where: { id: sessionId, module: AdminConfigModule.OFFER },
      select: {
        id: true,
        status: true,
        payload: true,
        result: true,
      },
    });
    if (!session) {
      return NextResponse.json({ ok: false, error: "Sesión no encontrada." }, { status: 404 });
    }

    if (session.status === AdminImportSessionStatus.applied && session.result) {
      return NextResponse.json({
        ...(session.result as Record<string, unknown>),
        sessionId,
        applied: true,
      });
    }

    const beforeSnapshot = await captureDraftConfigSnapshot(AdminConfigModule.OFFER);
    const summary = await applyPreparedAcademicOfferImport({
      payload: session.payload as unknown as PreparedAcademicOfferImportPayload,
      updatedBy: admin.email,
    });
    const afterSnapshot = await captureDraftConfigSnapshot(AdminConfigModule.OFFER);

    await prisma.adminImportSession.update({
      where: { id: sessionId },
      data: {
        status: AdminImportSessionStatus.applied,
        beforeSnapshot: beforeSnapshot as Prisma.InputJsonValue,
        afterSnapshot: afterSnapshot as Prisma.InputJsonValue,
        result: summary as Prisma.InputJsonValue,
        appliedAt: new Date(),
        appliedByUserId: admin.id,
        appliedByEmail: admin.email,
      },
    });

    await writeAdminAuditLog({
      module: AdminConfigModule.OFFER,
      action: AdminAuditAction.IMPORT_APPLY,
      source: AdminChangeSource.IMPORT,
      actor: admin,
      entityType: "AdminImportSession",
      entityId: sessionId,
      after: {
        cycle: summary.cycle,
        campusesProcessed: summary.campusesProcessed,
        offerings: summary.offerings,
      },
      importSessionId: sessionId,
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
      },
    });

    return NextResponse.json({ ...summary, sessionId, applied: true });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "No fue posible aplicar la sesión.";
    const admin = await getAdminUser().catch(() => null);
    captureException(error, {
      module: "offer-import",
      action: "apply",
      result: "failure",
      actorUserId: admin?.id ?? null,
      actorEmail: admin?.email ?? null,
      metadata: { message },
    }, "Academic offer import apply failed");
    await writeBusinessEventSafe({
      type: BusinessEventType.IMPORT_FAILED,
      userId: admin?.id ?? null,
      subjectType: "AdminImportSession",
      metadata: {
        module: AdminConfigModule.OFFER,
        stage: "apply",
        message,
      },
    });
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
