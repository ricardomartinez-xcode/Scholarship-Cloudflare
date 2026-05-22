import fs from "node:fs/promises";

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
import { writeBusinessEventSafe } from "@/lib/business-events";
import { normalizeAcademicOfferCycle } from "@/config/academicOffer";
import {
  prepareAcademicOfferImport,
  resolveDefaultOfferExcelPath,
} from "@/lib/importers/academic-offer";
import { captureException, logStructured } from "@/lib/observability";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let requestedCycle: string | null = null;
  try {
    const admin = await getAdminUser();
    if (!admin) {
      return NextResponse.json({ ok: false, error: "No autorizado." }, { status: 401 });
    }

    const form = await request.formData();
    const maybeFile = form.get("file");
    const cycleValue = form.get("cycle");
    const cycle = normalizeAcademicOfferCycle(
      typeof cycleValue === "string" ? cycleValue : null,
    );
    requestedCycle = cycle;

    if (!cycle) {
      return NextResponse.json(
        { ok: false, error: "Selecciona un ciclo válido: C1, C2 o C3." },
        { status: 400 },
      );
    }

    let input:
      | { kind: "buffer"; buffer: Uint8Array; fileName?: string }
      | { kind: "path"; filePath: string };
    let fileName: string | undefined;

    if (maybeFile && typeof maybeFile === "object" && "arrayBuffer" in maybeFile) {
      const file = maybeFile as File;
      const buffer = Buffer.from(await file.arrayBuffer());
      input = { kind: "buffer", buffer, fileName: file.name };
      fileName = file.name;
    } else {
      const filePath = await resolveDefaultOfferExcelPath();
      if (!filePath) {
        return NextResponse.json(
          {
            ok: false,
            error:
              "No se encontró un Excel por defecto en /docs. Sube un archivo .xlsx para validar.",
          },
          { status: 400 },
        );
      }
      await fs.access(filePath);
      input = { kind: "path", filePath };
      fileName = filePath.split(/[/\\]/).pop();
    }

    const prepared = await prepareAcademicOfferImport({
      input,
      cycle,
    });

    const session = await prisma.adminImportSession.create({
      data: {
        module: AdminConfigModule.OFFER,
        status: AdminImportSessionStatus.preview,
        source: AdminChangeSource.IMPORT,
        fileName: fileName ?? null,
        preview: prepared.previewRows as Prisma.InputJsonValue,
        payload: prepared.payload as Prisma.InputJsonValue,
        warnings: prepared.summary.warnings as Prisma.InputJsonValue,
        errors: [] as Prisma.InputJsonValue,
        summary: prepared.summary as Prisma.InputJsonValue,
        createdByUserId: admin.id,
        createdByEmail: admin.email,
      },
      select: { id: true },
    });

    await writeAdminAuditLog({
      module: AdminConfigModule.OFFER,
      action: AdminAuditAction.IMPORT_VALIDATE,
      source: AdminChangeSource.IMPORT,
      actor: admin,
      entityType: "AdminImportSession",
      entityId: session.id,
      after: {
        cycle: prepared.summary.cycle,
        campusesProcessed: prepared.summary.campusesProcessed,
        warnings: prepared.summary.warnings,
      },
      importSessionId: session.id,
    });

    await writeBusinessEventSafe({
      type: BusinessEventType.IMPORT_VALIDATED,
      userId: admin.id,
      subjectType: "AdminImportSession",
      subjectId: session.id,
      metadata: {
        module: AdminConfigModule.OFFER,
        cycle: prepared.summary.cycle,
        fileName: fileName ?? null,
        campusesProcessed: prepared.summary.campusesProcessed,
        previewRows: prepared.previewRows.length,
        warningCount: prepared.summary.warnings.length,
      },
    });

    logStructured("info", "Academic offer import validated", {
      module: "offer-import",
      action: "validate",
      result: "success",
      actorUserId: admin.id,
      actorEmail: admin.email,
      subjectType: "AdminImportSession",
      subjectId: session.id,
      metadata: {
        cycle: prepared.summary.cycle,
        campusesProcessed: prepared.summary.campusesProcessed,
        warningCount: prepared.summary.warnings.length,
      },
    });

    return NextResponse.json({
      ...prepared.summary,
      sessionId: session.id,
      previewRows: prepared.previewRows,
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "No fue posible validar el Excel.";
    const admin = await getAdminUser().catch(() => null);
    captureException(error, {
      module: "offer-import",
      action: "validate",
      result: "failure",
      actorUserId: admin?.id ?? null,
      actorEmail: admin?.email ?? null,
      metadata: {
        cycle: requestedCycle,
        message,
      },
    }, "Academic offer import validation failed");
    await writeBusinessEventSafe({
      type: BusinessEventType.IMPORT_FAILED,
      userId: admin?.id ?? null,
      subjectType: "AdminImportSession",
      metadata: {
        module: AdminConfigModule.OFFER,
        stage: "validate",
        cycle: requestedCycle,
        message,
      },
    });
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
