"use server";

import { revalidatePath } from "next/cache";
import ExcelJS from "exceljs";
import {
  AdminCapability,
  AdminAuditAction,
  AdminChangeSource,
  AdminConfigModule,
  AdminImportSessionStatus,
  Prisma,
} from "@prisma/client";

import { requireAdminCapabilityUser } from "@/lib/admin-session";
import { writeAdminAuditLog } from "@/lib/admin-audit";
import {
  captureDraftConfigSnapshot,
  restoreDraftConfigSnapshot,
  type DirectoryDraftSnapshot,
} from "@/lib/admin-config-snapshots";
import { syncDirectoryContactMethods } from "@/lib/directory-contact-sync";
import { prisma } from "@/lib/prisma";
import {
  PUBLIC_ROUTE_CACHE_TAGS,
  revalidatePublicRouteTags,
} from "@/lib/public-route-cache";
import { getDirectoryWriteMode } from "@/lib/runtime-modes";

const DIRECTORY_WRITE_CAPABILITY = AdminCapability.manage_directory;

type DirectoryImportResult = {
  ok: boolean;
  processed?: number;
  imported?: number;
  notFound?: string[];
  sample?: Array<{
    campus: string;
    zone: string | null;
    role: string | null;
    name: string | null;
    contact: string | null;
  }>;
  error?: string;
};

type DirectoryColumnMapping = {
  zone: number;
  campus: number;
  role: number;
  name: number;
  contact: number;
};

type DirectoryImportPayloadRow = {
  lineNumber: number;
  campusId: string | null;
  campusValue: string;
  campusName: string | null;
  zone: string | null;
  role: string | null;
  name: string | null;
  contact: string | null;
  existingId: string | null;
};

type DirectoryImportSessionResult = {
  ok: boolean;
  sessionId?: string;
  processed?: number;
  ready?: number;
  imported?: number;
  warnings?: string[];
  errors?: string[];
  sample?: Array<{
    campus: string;
    zone: string | null;
    role: string | null;
    name: string | null;
    contact: string | null;
  }>;
  error?: string;
  applied?: boolean;
  rolledBack?: boolean;
};

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let inQuotes = false;
  let current = "";
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

function normalizeHeader(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

const HEADER_ALIASES = {
  zone: ["zona", "area"],
  campus: ["plantel", "campus", "sede"],
  role: ["rol", "cargo", "puesto"],
  name: ["nombre", "responsable"],
  contact: ["contacto", "correo", "email", "telefono", "celular", "whatsapp"],
} as const;

function findHeaderIndex(
  normalizedRow: string[],
  aliases: readonly string[]
) {
  return normalizedRow.findIndex((cell) =>
    aliases.some((alias) => cell === alias)
  );
}

function getHeaderMapping(row: string[]): DirectoryColumnMapping | null {
  const normalized = row.map(normalizeHeader);
  const mapping: DirectoryColumnMapping = {
    zone: findHeaderIndex(normalized, HEADER_ALIASES.zone),
    campus: findHeaderIndex(normalized, HEADER_ALIASES.campus),
    role: findHeaderIndex(normalized, HEADER_ALIASES.role),
    name: findHeaderIndex(normalized, HEADER_ALIASES.name),
    contact: findHeaderIndex(normalized, HEADER_ALIASES.contact),
  };

  return Object.values(mapping).every((value) => value >= 0) ? mapping : null;
}

function hasHeaderHints(row: string[]) {
  const normalized = row.map(normalizeHeader);
  const allAliases = Object.values(HEADER_ALIASES).flat();
  return normalized.some((cell) =>
    allAliases.some((alias) => cell === alias || cell.includes(alias))
  );
}

async function loadDirectoryAuditPayload(id: string) {
  return prisma.directoryContact.findUnique({
    where: { id },
    select: {
      id: true,
      campusId: true,
      zone: true,
      role: true,
      name: true,
      email: true,
      phone: true,
      contactLabel: true,
      source: true,
      methods: {
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        select: {
          id: true,
          type: true,
          value: true,
          normalizedValue: true,
          isPrimary: true,
          sortOrder: true,
        },
      },
    },
  });
}

async function parseDirectoryImportFile(file: File) {
  const extension = file.name.toLowerCase().split(".").pop();
  if (extension !== "csv" && extension !== "xlsx") {
    throw new Error("Formato no soportado. Usa archivos .csv o .xlsx.");
  }

  let rows: string[][] = [];
  if (extension === "csv") {
    const text = await file.text();
    const lines = text.split(/\r?\n/).filter((line) => line.trim());
    if (lines.length < 1) {
      throw new Error("El CSV no contiene filas.");
    }
    rows = lines.map((line) => parseCsvLine(line));
  } else {
    const buffer = await file.arrayBuffer();
    const workbook = new ExcelJS.Workbook();
    const xlsxPayload = Buffer.from(buffer) as unknown as Parameters<
      typeof workbook.xlsx.load
    >[0];
    await workbook.xlsx.load(xlsxPayload);
    const firstSheet = workbook.worksheets[0];
    if (!firstSheet) {
      throw new Error("El archivo XLSX no contiene hojas.");
    }

    rows = firstSheet
      .getSheetValues()
      .slice(1)
      .map((row) => {
        if (!Array.isArray(row)) return [];
        return row.slice(1).map((cell) => String(cell ?? "").trim());
      })
      .filter((row) => row.some((cell) => cell));
    if (rows.length < 1) {
      throw new Error("El XLSX no contiene filas de datos.");
    }
  }

  const firstRow = rows[0] ?? [];
  const detectedMapping = getHeaderMapping(firstRow);
  const hasHeaderRow = Boolean(detectedMapping);
  const startIndex = hasHeaderRow ? 1 : 0;

  if (!hasHeaderRow && hasHeaderHints(firstRow)) {
    throw new Error(
      "Se detectaron encabezados, pero no se pudieron mapear correctamente. Usa columnas como Área/Zona, Plantel, Rol/Cargo, Nombre y Contacto/Correo/Teléfono.",
    );
  }

  if (!hasHeaderRow && rows.some((row) => row.length < 5)) {
    throw new Error(
      "Formato inválido. El orden esperado es: Zona, Plantel, Rol, Nombre, Contacto.",
    );
  }

  const campuses = await prisma.campus.findMany({
    select: { id: true, code: true, metaKey: true, slug: true, name: true },
  });

  const payloadRows: DirectoryImportPayloadRow[] = [];
  const sample: DirectoryImportSessionResult["sample"] = [];
  const warnings: string[] = [];
  const notFound: string[] = [];
  const duplicateKeys = new Set<string>();
  const seenKeys = new Set<string>();
  const processed = Math.max(rows.length - startIndex, 0);

  for (let index = startIndex; index < rows.length; index++) {
    const cols = rows[index];
    if (cols.every((cell) => !cell)) continue;

    const zoneIndex = detectedMapping?.zone ?? 0;
    const campusIndex = detectedMapping?.campus ?? 1;
    const roleIndex = detectedMapping?.role ?? 2;
    const nameIndex = detectedMapping?.name ?? 3;
    const contactIndex = detectedMapping?.contact ?? 4;

    const zone = (cols[zoneIndex] ?? "").trim() || null;
    const campusValue = (cols[campusIndex] ?? "").trim();
    const role = (cols[roleIndex] ?? "").trim() || null;
    const name = (cols[nameIndex] ?? "").trim() || null;
    const contact = (cols[contactIndex] ?? "").trim() || null;

    const campusMatch = campuses.find(
      (campus) =>
        (campusValue &&
          campus.code.toLowerCase() === campusValue.toLowerCase()) ||
        (campusValue &&
          campus.metaKey.toLowerCase() === campusValue.toLowerCase()) ||
        (campusValue &&
          campus.slug.toLowerCase() === campusValue.toLowerCase()) ||
        (campusValue &&
          campus.name.toLowerCase() === campusValue.toLowerCase()),
    );

    if (!campusMatch) {
      notFound.push(campusValue || `fila ${index + 1}`);
      payloadRows.push({
        lineNumber: index + 1,
        campusId: null,
        campusValue,
        campusName: null,
        zone,
        role,
        name,
        contact,
        existingId: null,
      });
      continue;
    }

    const existing = await prisma.directoryContact.findFirst({
      where: {
        campusId: campusMatch.id,
        role,
        name,
        email: contact,
      },
      select: { id: true },
    });

    const dedupeKey = [
      campusMatch.id,
      role ?? "",
      name ?? "",
      contact ?? "",
      zone ?? "",
    ].join("|");
    if (seenKeys.has(dedupeKey)) {
      duplicateKeys.add(dedupeKey);
    }
    seenKeys.add(dedupeKey);

    payloadRows.push({
      lineNumber: index + 1,
      campusId: campusMatch.id,
      campusValue,
      campusName: campusMatch.name,
      zone,
      role,
      name,
      contact,
      existingId: existing?.id ?? null,
    });

    if ((sample?.length ?? 0) < 10) {
      sample?.push({
        campus: campusMatch.name,
        zone,
        role,
        name,
        contact,
      });
    }
  }

  if (notFound.length > 0) {
    warnings.push(`Planteles no encontrados: ${notFound.join(", ")}`);
  }
  if (duplicateKeys.size > 0) {
    warnings.push(
      `Se detectaron ${duplicateKeys.size} fila(s) duplicadas dentro del archivo; se aplicarán en el orden recibido.`,
    );
  }

  const ready = payloadRows.filter((row) => row.campusId).length;
  const errors =
    ready > 0
      ? []
      : ["No se encontraron filas válidas para aplicar al draft del directorio."];

  return {
    processed,
    ready,
    sample: sample ?? [],
    warnings,
    errors,
    rows: payloadRows,
  };
}

async function persistDirectoryContact(params: {
  id?: string;
  campusId: string;
  zone: string | null;
  role: string | null;
  name: string | null;
  contact: string | null;
  source: string | null;
}) {
  const writeMode = getDirectoryWriteMode();
  const data = {
    campusId: params.campusId,
    zone: params.zone,
    role: params.role,
    name: params.name,
    email: params.contact,
    source: params.source,
  };

  const record = params.id
    ? await prisma.directoryContact.update({
        where: { id: params.id },
        data,
      })
    : await prisma.directoryContact.create({
        data: { id: crypto.randomUUID(), ...data },
      });

  if (writeMode !== "legacy") {
    await syncDirectoryContactMethods(record.id, params.contact);
  }

  return record;
}

export async function upsertDirectoryContactAction(formData: FormData) {
  try {
    const admin = await requireAdminCapabilityUser(DIRECTORY_WRITE_CAPABILITY);

    const id = String(formData.get("id") ?? "").trim();
    const campusId = String(formData.get("campusId") ?? "").trim();
    const zone = String(formData.get("zone") ?? "").trim() || null;
    const role = String(formData.get("role") ?? "").trim() || null;
    const name = String(formData.get("name") ?? "").trim() || null;
    const contact =
      String(formData.get("contact") ?? formData.get("email") ?? "").trim() || null;
    const source = String(formData.get("source") ?? "").trim() || null;

    if (!campusId) return { ok: false, error: "Plantel requerido." };

    const before = id ? await loadDirectoryAuditPayload(id) : null;
    const saved = await persistDirectoryContact({
      id: id || undefined,
      campusId,
      zone,
      role,
      name,
      contact,
      source,
    });

    const after = await loadDirectoryAuditPayload(saved.id);
    if (after) {
      await writeAdminAuditLog({
        module: AdminConfigModule.DIRECTORY,
        action: before ? AdminAuditAction.UPDATE : AdminAuditAction.CREATE,
        actor: admin,
        entityType: "DirectoryContact",
        entityId: after.id,
        before,
        after,
      });
    }

    revalidatePath("/admin/unidep/directory");
    revalidatePath("/api/public/directorio");
    revalidatePath("/unidep");
    revalidatePublicRouteTags([PUBLIC_ROUTE_CACHE_TAGS.directorio]);
    return { ok: true };
  } catch {
    return { ok: false, error: "No fue posible guardar el contacto." };
  }
}

export async function deleteDirectoryContactAction(formData: FormData) {
  const admin = await requireAdminCapabilityUser(DIRECTORY_WRITE_CAPABILITY);
  const id = String(formData.get("id") ?? "").trim();
  if (!id) return;
  const before = await loadDirectoryAuditPayload(id);
  await prisma.directoryContact.delete({ where: { id } });
  if (before) {
    await writeAdminAuditLog({
      module: AdminConfigModule.DIRECTORY,
      action: AdminAuditAction.DELETE,
      actor: admin,
      entityType: "DirectoryContact",
      entityId: before.id,
      before,
      after: null,
    });
  }
  revalidatePath("/admin/unidep/directory");
  revalidatePath("/api/public/directorio");
  revalidatePath("/unidep");
  revalidatePublicRouteTags([PUBLIC_ROUTE_CACHE_TAGS.directorio]);
}

export async function createDirectoryImportSessionAction(
  formData: FormData,
): Promise<DirectoryImportSessionResult> {
  try {
    const admin = await requireAdminCapabilityUser(DIRECTORY_WRITE_CAPABILITY);
    const file = formData.get("file");
    if (!(file instanceof File) || file.size <= 0) {
      return { ok: false, error: "Debes seleccionar un archivo CSV o XLSX." };
    }

    const parsed = await parseDirectoryImportFile(file);
    const session = await prisma.adminImportSession.create({
      data: {
        module: AdminConfigModule.DIRECTORY,
        status: AdminImportSessionStatus.preview,
        source: AdminChangeSource.IMPORT,
        fileName: file.name,
        preview: (parsed.sample ?? []) as Prisma.InputJsonValue,
        payload: parsed.rows as Prisma.InputJsonValue,
        warnings: parsed.warnings as Prisma.InputJsonValue,
        errors: parsed.errors as Prisma.InputJsonValue,
        summary: {
          processed: parsed.processed,
          ready: parsed.ready,
        },
        createdByUserId: admin.id,
        createdByEmail: admin.email,
      },
      select: { id: true },
    });

    await writeAdminAuditLog({
      module: AdminConfigModule.DIRECTORY,
      action: AdminAuditAction.IMPORT_VALIDATE,
      source: AdminChangeSource.IMPORT,
      actor: admin,
      entityType: "AdminImportSession",
      entityId: session.id,
      after: {
        processed: parsed.processed,
        ready: parsed.ready,
        warnings: parsed.warnings,
        errors: parsed.errors,
      },
      importSessionId: session.id,
    });

    return {
      ok: true,
      sessionId: session.id,
      processed: parsed.processed,
      ready: parsed.ready,
      warnings: parsed.warnings,
      errors: parsed.errors,
      sample: parsed.sample ?? [],
    };
  } catch (error: unknown) {
    return {
      ok: false,
      error:
        error instanceof Error ? error.message : "No fue posible validar el archivo.",
    };
  }
}

export async function applyDirectoryImportSessionAction(
  formData: FormData,
): Promise<DirectoryImportSessionResult> {
  try {
    const admin = await requireAdminCapabilityUser(DIRECTORY_WRITE_CAPABILITY);
    const sessionId = String(formData.get("sessionId") ?? "").trim();
    if (!sessionId) {
      return { ok: false, error: "Sesión inválida." };
    }

    const session = await prisma.adminImportSession.findFirst({
      where: { id: sessionId, module: AdminConfigModule.DIRECTORY },
      select: {
        id: true,
        status: true,
        payload: true,
        warnings: true,
        errors: true,
        result: true,
        beforeSnapshot: true,
      },
    });
    if (!session) {
      return { ok: false, error: "No se encontró la sesión de importación." };
    }
    if (session.status === AdminImportSessionStatus.applied && session.result) {
      const result = session.result as {
        processed?: number;
        imported?: number;
        warnings?: string[];
        errors?: string[];
      };
      return {
        ok: true,
        sessionId,
        processed: result.processed ?? 0,
        imported: result.imported ?? 0,
        warnings: result.warnings ?? [],
        errors: result.errors ?? [],
        applied: true,
      };
    }

    const rows = (session.payload ?? []) as unknown as DirectoryImportPayloadRow[];
    const errors = ((session.errors ?? []) as unknown as string[]) ?? [];
    if (errors.length > 0) {
      return {
        ok: false,
        error: errors.join(" "),
      };
    }

    const beforeSnapshot = await captureDraftConfigSnapshot(
      AdminConfigModule.DIRECTORY,
    );
    let imported = 0;
    for (const row of rows) {
      if (!row.campusId) continue;
      const existingId =
        row.existingId ||
        (
          await prisma.directoryContact.findFirst({
            where: {
              campusId: row.campusId,
              role: row.role,
              name: row.name,
              email: row.contact,
            },
            select: { id: true },
          })
        )?.id ||
        undefined;

      await persistDirectoryContact({
        id: existingId,
        campusId: row.campusId,
        zone: row.zone,
        role: row.role,
        name: row.name,
        contact: row.contact,
        source: `Import session ${sessionId.slice(0, 8)}`,
      });
      imported += 1;
    }

    const afterSnapshot = await captureDraftConfigSnapshot(
      AdminConfigModule.DIRECTORY,
    );
    const warnings = ((session.warnings ?? []) as unknown as string[]) ?? [];
    const result = {
      processed: rows.length,
      imported,
      warnings,
      errors,
    };

    await prisma.adminImportSession.update({
      where: { id: sessionId },
      data: {
        status: AdminImportSessionStatus.applied,
        beforeSnapshot: beforeSnapshot as Prisma.InputJsonValue,
        afterSnapshot: afterSnapshot as Prisma.InputJsonValue,
        result: result as Prisma.InputJsonValue,
        appliedAt: new Date(),
        appliedByUserId: admin.id,
        appliedByEmail: admin.email,
      },
    });

    await writeAdminAuditLog({
      module: AdminConfigModule.DIRECTORY,
      action: AdminAuditAction.IMPORT_APPLY,
      source: AdminChangeSource.IMPORT,
      actor: admin,
      entityType: "AdminImportSession",
      entityId: sessionId,
      after: result,
      importSessionId: sessionId,
    });

    revalidatePath("/admin/unidep/directory");
    revalidatePath("/api/public/directorio");
    revalidatePath("/unidep");
    revalidatePublicRouteTags([PUBLIC_ROUTE_CACHE_TAGS.directorio]);

    return {
      ok: true,
      sessionId,
      processed: result.processed,
      imported: result.imported,
      warnings,
      errors,
      applied: true,
    };
  } catch (error: unknown) {
    return {
      ok: false,
      error:
        error instanceof Error ? error.message : "No fue posible aplicar la sesión.",
    };
  }
}

export async function rollbackDirectoryImportSessionAction(
  formData: FormData,
): Promise<DirectoryImportSessionResult> {
  try {
    const admin = await requireAdminCapabilityUser(DIRECTORY_WRITE_CAPABILITY);
    const sessionId = String(formData.get("sessionId") ?? "").trim();
    if (!sessionId) {
      return { ok: false, error: "Sesión inválida." };
    }

    const session = await prisma.adminImportSession.findFirst({
      where: { id: sessionId, module: AdminConfigModule.DIRECTORY },
      select: {
        id: true,
        status: true,
        beforeSnapshot: true,
      },
    });
    if (!session || !session.beforeSnapshot) {
      return { ok: false, error: "La sesión no tiene rollback disponible." };
    }
    if (session.status === AdminImportSessionStatus.rolled_back) {
      return { ok: true, sessionId, rolledBack: true };
    }

    await restoreDraftConfigSnapshot(
      AdminConfigModule.DIRECTORY,
      session.beforeSnapshot as unknown as DirectoryDraftSnapshot,
    );

    await prisma.adminImportSession.update({
      where: { id: sessionId },
      data: {
        status: AdminImportSessionStatus.rolled_back,
        rolledBackAt: new Date(),
      },
    });

    await writeAdminAuditLog({
      module: AdminConfigModule.DIRECTORY,
      action: AdminAuditAction.IMPORT_ROLLBACK,
      source: AdminChangeSource.IMPORT,
      actor: admin,
      entityType: "AdminImportSession",
      entityId: sessionId,
      message: "Rollback lógico del directorio draft.",
      importSessionId: sessionId,
    });

    revalidatePath("/admin/unidep/directory");
    revalidatePath("/api/public/directorio");
    revalidatePath("/unidep");
    revalidatePublicRouteTags([PUBLIC_ROUTE_CACHE_TAGS.directorio]);

    return { ok: true, sessionId, rolledBack: true };
  } catch (error: unknown) {
    return {
      ok: false,
      error:
        error instanceof Error ? error.message : "No fue posible revertir la sesión.",
    };
  }
}

export async function importDirectoryContactsAction(formData: FormData): Promise<DirectoryImportResult> {
  try {
    await requireAdminCapabilityUser(DIRECTORY_WRITE_CAPABILITY);

    const file = formData.get("file");
    if (!(file instanceof File) || file.size <= 0) {
      return { ok: false, error: "Debes seleccionar un archivo CSV o XLSX." };
    }

    const extension = file.name.toLowerCase().split(".").pop();
    if (extension !== "csv" && extension !== "xlsx") {
      return { ok: false, error: "Formato no soportado. Usa archivos .csv o .xlsx." };
    }

    let rows: string[][] = [];
    if (extension === "csv") {
      const text = await file.text();
      const lines = text.split(/\r?\n/).filter((l) => l.trim());
      if (lines.length < 1) {
        return { ok: false, error: "El CSV no contiene filas." };
      }
      rows = lines.map((line) => parseCsvLine(line));
    } else {
      const buffer = await file.arrayBuffer();
      const workbook = new ExcelJS.Workbook();
      const xlsxPayload = Buffer.from(buffer) as unknown as Parameters<typeof workbook.xlsx.load>[0];
      await workbook.xlsx.load(xlsxPayload);
      const firstSheet = workbook.worksheets[0];
      if (!firstSheet) {
        return { ok: false, error: "El archivo XLSX no contiene hojas." };
      }

      rows = firstSheet
        .getSheetValues()
        .slice(1)
        .map((row) => {
          if (!Array.isArray(row)) return [];
          return row.slice(1).map((cell) => String(cell ?? "").trim());
        })
        .filter((row) => row.some((cell) => cell));
      if (rows.length < 1) {
        return { ok: false, error: "El XLSX no contiene filas de datos." };
      }
    }

    const firstRow = rows[0] ?? [];
    const detectedMapping = getHeaderMapping(firstRow);
    const hasHeaderRow = Boolean(detectedMapping);
    const startIndex = hasHeaderRow ? 1 : 0;

    if (!hasHeaderRow && hasHeaderHints(firstRow)) {
      return {
        ok: false,
        error:
          "Se detectaron encabezados, pero no se pudieron mapear correctamente. Usa columnas como Área/Zona, Plantel, Rol/Cargo, Nombre y Contacto/Correo/Teléfono.",
      };
    }

    if (!hasHeaderRow && rows.some((row) => row.length < 5)) {
      return {
        ok: false,
        error: "Formato inválido. El orden esperado es: Zona, Plantel, Rol, Nombre, Contacto.",
      };
    }

    const campuses = await prisma.campus.findMany({
      select: { id: true, code: true, metaKey: true, slug: true, name: true },
    });

    const notFound: string[] = [];
    const sample: Array<{
      campus: string;
      zone: string | null;
      role: string | null;
      name: string | null;
      contact: string | null;
    }> = [];
    let imported = 0;
    const processed = Math.max(rows.length - startIndex, 0);

    for (let i = startIndex; i < rows.length; i++) {
      const cols = rows[i];
      if (cols.every((c) => !c)) continue;

      const zoneIndex = detectedMapping?.zone ?? 0;
      const campusIndex = detectedMapping?.campus ?? 1;
      const roleIndex = detectedMapping?.role ?? 2;
      const nameIndex = detectedMapping?.name ?? 3;
      const contactIndex = detectedMapping?.contact ?? 4;

      const zone = (cols[zoneIndex] ?? "").trim() || null;
      const campusValue = (cols[campusIndex] ?? "").trim();
      const role = (cols[roleIndex] ?? "").trim() || null;
      const name = (cols[nameIndex] ?? "").trim() || null;
      const contact = (cols[contactIndex] ?? "").trim() || null;

      const campusMatch = campuses.find(
        (c) =>
          (campusValue && c.code.toLowerCase() === campusValue.toLowerCase()) ||
          (campusValue && c.metaKey.toLowerCase() === campusValue.toLowerCase()) ||
          (campusValue && c.slug.toLowerCase() === campusValue.toLowerCase()) ||
          (campusValue && c.name.toLowerCase() === campusValue.toLowerCase())
      );

      if (!campusMatch) {
        notFound.push(campusValue || `fila ${i + 1}`);
        continue;
      }

      const existing = await prisma.directoryContact.findFirst({
        where: {
          campusId: campusMatch.id,
          role,
          name,
          email: contact,
        },
        select: { id: true },
      });

      await persistDirectoryContact({
        id: existing?.id,
        campusId: campusMatch.id,
        zone,
        role,
        name,
        contact,
        source: "Import CSV/XLSX",
      });

      if (sample.length < 10) {
        sample.push({
          campus: campusMatch.name,
          zone,
          role,
          name,
          contact,
        });
      }

      imported++;
    }

    revalidatePath("/admin/unidep/directory");
    revalidatePath("/api/public/directorio");
    revalidatePath("/unidep");
    revalidatePublicRouteTags([PUBLIC_ROUTE_CACHE_TAGS.directorio]);

    return { ok: true, processed, imported, notFound, sample };
  } catch (err) {
    console.error("Directory file import error:", err);
    return { ok: false, error: "Error al importar el archivo." };
  }
}
