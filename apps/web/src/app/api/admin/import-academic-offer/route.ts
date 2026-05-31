import fs from "node:fs/promises";

import { NextResponse } from "next/server";
import {
  AdminChangeSource,
  AdminConfigModule,
  BusinessEventType,
} from "@prisma/client";

import { getAdminUser } from "@/lib/admin-session";
import { writeBusinessEventSafe } from "@/lib/business-events";
import { normalizeAcademicOfferCycle } from "@/config/academicOffer";
import {
  prepareAcademicOfferImport,
  resolveDefaultOfferExcelPath,
} from "@/lib/importers/academic-offer";
import { prepareAcademicOfferCsvImport } from "@/lib/importers/academic-offer-csv";
import { captureException, logStructured } from "@/lib/observability";
import {
  createAdminImportPreviewSession,
  createImportFileChecksum,
} from "@/lib/importers/admin-import-sessions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isUploadFile(value: FormDataEntryValue | null): value is File {
  return Boolean(value && typeof value === "object" && "arrayBuffer" in value);
}

function fileExtension(fileName?: string | null) {
  const normalized = String(fileName ?? "").trim().toLowerCase();
  if (normalized.endsWith(".csv")) return "csv";
  if (normalized.endsWith(".xlsx")) return "xlsx";
  return "";
}

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
      return NextResponse.json({ ok: false, error: "Selecciona un ciclo válido: C1, C2 o C3." }, { status: 400 });
    }

    let prepared: Awaited<ReturnType<typeof prepareAcademicOfferImport>>;
    let fileName: string | undefined;
    let fileChecksum: string | null = null;

    if (isUploadFile(maybeFile)) {
      const file = maybeFile;
      const buffer = Buffer.from(await file.arrayBuffer());
      const extension = fileExtension(file.name);

      fileName = file.name;
      fileChecksum = createImportFileChecksum(buffer);

      if (extension === "csv") {
        prepared = await prepareAcademicOfferCsvImport({
          buffer,
          fileName,
          cycle,
        });
      } else if (extension === "xlsx") {
        prepared = await prepareAcademicOfferImport({
          input: { kind: "buffer", buffer, fileName },
          cycle,
        });
      } else {
        return NextResponse.json({ ok: false, error: "Formato no soportado. Usa un archivo .xlsx o .csv." }, { status: 400 });
      }
    } else {
      const filePath = await resolveDefaultOfferExcelPath();
      if (!filePath) {
        return NextResponse.json({ ok: false, error: "No se encontró un Excel por defecto en /docs. Sube un archivo .xlsx o .csv para validar." }, { status: 400 });
      }

      await fs.access(filePath);
      prepared = await prepareAcademicOfferImport({
        input: { kind: "path", filePath },
        cycle,
      });
      fileName = filePath.split(/[\\/]/).pop();

      try {
        fileChecksum = createImportFileChecksum(await fs.readFile(filePath));
      } catch {
        fileChecksum = null;
      }
    }

    const session = await createAdminImportPreviewSession({
      module: AdminConfigModule.OFFER,
      actor: admin,
      kind: "academic-offer",
      fileName: fileName ?? null,
      fileChecksum,
      preview: prepared.previewRows,
      payload: prepared.payload,
      warnings: prepared.summary.warnings,
      errors: [],
      summary: prepared.summary,
      source: AdminChangeSource.IMPORT,
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
    const message = error instanceof Error ? error.message : "No fue posible validar el archivo.";
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
