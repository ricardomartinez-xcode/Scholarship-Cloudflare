import {
  AdminAuditAction,
  AdminCapability,
  AdminChangeSource,
  AdminConfigModule,
  AdminImportSessionStatus,
  BusinessEventType,
  Prisma,
} from "@prisma/client";
import ExcelJS from "exceljs";

import { requireAdminApiCapability } from "@/lib/api-auth";
import {
  adminApiError,
  adminApiSuccess,
  buildAdminRequestId,
  logAdminApiFailure,
} from "@/lib/admin-api";
import { writeAdminAuditLog } from "@/lib/admin-audit";
import { writeBusinessEventSafe } from "@/lib/business-events";
import {
  normalizePriceListWorkbookRows,
  priceListRowsToCsv,
  type PriceListWorkbookSheet,
} from "@/lib/importers/price-list-format";
import {
  preparePricesCsvImport,
  PricesCsvValidationError,
} from "@/lib/importers/prices-csv";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function cellToPrimitive(value: ExcelJS.CellValue): string | number | boolean | Date | null {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value;
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return value;
  }
  if ("result" in value) return cellToPrimitive(value.result as ExcelJS.CellValue);
  if ("text" in value) return String(value.text ?? "");
  if ("richText" in value) {
    return value.richText.map((part) => part.text).join("");
  }
  return String(value);
}

async function normalizePriceImportFile(file: File) {
  const lowerName = file.name.toLowerCase();
  if (lowerName.endsWith(".csv")) return file;
  if (!lowerName.endsWith(".xlsx")) {
    throw new PricesCsvValidationError(
      "Formato no soportado. Usa un archivo .xlsx o .csv.",
      "INVALID_FILE_TYPE",
    );
  }

  const workbook = new ExcelJS.Workbook();
  const buffer = Buffer.from(await file.arrayBuffer());
  await workbook.xlsx.load(buffer as unknown as Parameters<typeof workbook.xlsx.load>[0]);

  const sheets: PriceListWorkbookSheet[] = workbook.worksheets.map((worksheet) => {
    const rows: PriceListWorkbookSheet["rows"] = [];
    worksheet.eachRow({ includeEmpty: false }, (row) => {
      const values = [];
      for (let index = 1; index <= worksheet.columnCount; index += 1) {
        values.push(cellToPrimitive(row.getCell(index).value));
      }
      rows.push(values);
    });
    return { name: worksheet.name, rows };
  });

  const normalizedRows = normalizePriceListWorkbookRows({ sheets });
  if (!normalizedRows.length) {
    throw new PricesCsvValidationError(
      "No se encontraron filas válidas de Precio lista en el archivo.",
      "NO_VALID_ROWS",
    );
  }

  const csv = priceListRowsToCsv(normalizedRows);
  return new File([csv], `${file.name.replace(/\.[^.]+$/, "")}.normalized.csv`, {
    type: "text/csv",
  });
}

function isPricesCsvValidationError(error: unknown): error is PricesCsvValidationError {
  return error instanceof PricesCsvValidationError;
}

export async function POST(request: Request) {
  const requestId = buildAdminRequestId("admin_prices_import");
  try {
    const operationsAuth = await requireAdminApiCapability(
      requestId,
      AdminCapability.view_admin_operations,
    );
    if (!operationsAuth.ok) return operationsAuth.response;

    const auth = await requireAdminApiCapability(requestId, AdminCapability.manage_prices);
    if (!auth.ok) return auth.response;

    const form = await request.formData();
    const maybeFile = form.get("file");
    if (!(maybeFile instanceof File) || maybeFile.size <= 0) {
      return adminApiError({
        requestId,
        status: 400,
        errorCode: "MISSING_FILE",
        error: "Debes subir un archivo CSV para importar precios.",
        recoverable: true,
      });
    }
    if (!maybeFile.name.toLowerCase().endsWith(".csv") && !maybeFile.name.toLowerCase().endsWith(".xlsx")) {
      return adminApiError({
        requestId,
        status: 400,
        errorCode: "INVALID_FILE_TYPE",
        error: "Formato no soportado. Usa un archivo .xlsx o .csv.",
        recoverable: true,
      });
    }

    const normalizedFile = await normalizePriceImportFile(maybeFile);
    const prepared = await preparePricesCsvImport({ file: normalizedFile });
    const session = await prisma.adminImportSession.create({
      data: {
        module: AdminConfigModule.PRICES,
        status: AdminImportSessionStatus.preview,
        source: AdminChangeSource.IMPORT,
        fileName: maybeFile.name,
        preview: prepared.previewRows as Prisma.InputJsonValue,
        payload: prepared.payload as Prisma.InputJsonValue,
        warnings: prepared.summary.warnings as Prisma.InputJsonValue,
        errors: prepared.summary.errors as Prisma.InputJsonValue,
        summary: prepared.summary as Prisma.InputJsonValue,
        createdByUserId: auth.admin.id,
        createdByEmail: auth.admin.email,
      },
      select: { id: true },
    });

    await writeAdminAuditLog({
      module: AdminConfigModule.PRICES,
      action: AdminAuditAction.IMPORT_VALIDATE,
      source: AdminChangeSource.IMPORT,
      actor: auth.admin,
      entityType: "AdminImportSession",
      entityId: session.id,
      after: prepared.summary,
      importSessionId: session.id,
    });

    await writeBusinessEventSafe({
      type: BusinessEventType.IMPORT_VALIDATED,
      userId: auth.admin.id,
      subjectType: "AdminImportSession",
      subjectId: session.id,
      metadata: {
        module: AdminConfigModule.PRICES,
        fileName: maybeFile.name,
        processed: prepared.summary.processed,
        ready: prepared.summary.ready,
        warnings: prepared.summary.warnings.length,
        errors: prepared.summary.errors.length,
      },
    });

    return adminApiSuccess(
      requestId,
      {
        sessionId: session.id,
        ...prepared.summary,
        previewRows: prepared.previewRows,
      },
      { message: "Importación de precios validada." },
    );
  } catch (error) {
    if (isPricesCsvValidationError(error)) {
      return adminApiError({
        requestId,
        status: error.status,
        errorCode: error.code,
        error: error.message,
        recoverable: true,
      });
    }

    logAdminApiFailure({
      requestId,
      module: "admin-prices-import",
      action: "validate",
      error,
    });
    return adminApiError({
      requestId,
      status: 500,
      errorCode: "PRICES_IMPORT_VALIDATE_FAILED",
      error:
        error instanceof Error ? error.message : "No fue posible validar el CSV de precios.",
      recoverable: true,
    });
  }
}
