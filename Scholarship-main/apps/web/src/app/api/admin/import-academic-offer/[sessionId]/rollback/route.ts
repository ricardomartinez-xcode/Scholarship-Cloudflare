import { NextResponse } from "next/server";
import {
  AdminAuditAction,
  AdminChangeSource,
  AdminConfigModule,
  AdminImportSessionStatus,
  BusinessEventType,
} from "@prisma/client";

import { getAdminUser } from "@/lib/admin-session";
import { writeAdminAuditLog } from "@/lib/admin-audit";
import { restoreDraftConfigSnapshot } from "@/lib/admin-config-snapshots";
import { writeBusinessEventSafe } from "@/lib/business-events";
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
        beforeSnapshot: true,
      },
    });
    if (!session || !session.beforeSnapshot) {
      return NextResponse.json(
        { ok: false, error: "La sesión no tiene rollback disponible." },
        { status: 404 },
      );
    }

    if (session.status === AdminImportSessionStatus.rolled_back) {
      return NextResponse.json({ ok: true, sessionId, rolledBack: true });
    }

    await restoreDraftConfigSnapshot(
      AdminConfigModule.OFFER,
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
      module: AdminConfigModule.OFFER,
      action: AdminAuditAction.IMPORT_ROLLBACK,
      source: AdminChangeSource.IMPORT,
      actor: admin,
      entityType: "AdminImportSession",
      entityId: sessionId,
      message: "Rollback lógico del draft de oferta académica.",
      importSessionId: sessionId,
    });

    await writeBusinessEventSafe({
      type: BusinessEventType.IMPORT_ROLLED_BACK,
      userId: admin.id,
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
      actorUserId: admin.id,
      actorEmail: admin.email,
      subjectType: "AdminImportSession",
      subjectId: sessionId,
    });

    return NextResponse.json({ ok: true, sessionId, rolledBack: true });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "No fue posible revertir la sesión.";
    const admin = await getAdminUser().catch(() => null);
    captureException(error, {
      module: "offer-import",
      action: "rollback",
      result: "failure",
      actorUserId: admin?.id ?? null,
      actorEmail: admin?.email ?? null,
      metadata: { message },
    }, "Academic offer import rollback failed");
    await writeBusinessEventSafe({
      type: BusinessEventType.IMPORT_FAILED,
      userId: admin?.id ?? null,
      subjectType: "AdminImportSession",
      metadata: {
        module: AdminConfigModule.OFFER,
        stage: "rollback",
        message,
      },
    });
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
