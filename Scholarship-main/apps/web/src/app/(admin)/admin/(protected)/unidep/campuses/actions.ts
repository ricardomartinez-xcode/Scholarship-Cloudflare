"use server";

import { revalidatePath } from "next/cache";
import ExcelJS from "exceljs";
import { AdminCapability } from "@prisma/client";

import { requireAdminCapabilityUser } from "@/lib/admin-session";
import { prisma } from "@/lib/prisma";
import {
  PUBLIC_ROUTE_CACHE_TAGS,
  revalidatePublicRouteTags,
} from "@/lib/public-route-cache";

const DIRECTORY_WRITE_CAPABILITY = AdminCapability.manage_directory;

export async function updateCampusContactAction(formData: FormData) {
  try {
    await requireAdminCapabilityUser(DIRECTORY_WRITE_CAPABILITY);

    const id = String(formData.get("id") ?? "").trim();
    if (!id) return { ok: false, error: "ID requerido." };

    const address = String(formData.get("address") ?? "").trim() || null;
    const phone = String(formData.get("phone") ?? "").trim() || null;
    const whatsapp = String(formData.get("whatsapp") ?? "").trim() || null;

    await prisma.campus.update({
      where: { id },
      data: { address, phone, whatsapp },
    });

    revalidatePath("/admin/unidep/campuses");
    revalidatePath("/api/public/campuses");
    revalidatePath("/unidep");
    revalidatePublicRouteTags([PUBLIC_ROUTE_CACHE_TAGS.campuses]);
    return { ok: true };
  } catch {
    return { ok: false, error: "No fue posible actualizar el plantel." };
  }
}

type CsvImportResult = {
  ok: boolean;
  processed?: number;
  updated?: number;
  notFound?: string[];
  error?: string;
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

function isExpectedHeaderRow(row: string[]): boolean {
  const normalized = row.map(normalizeHeader);
  return (
    normalized[0] === "plantel" &&
    normalized[1] === "direccion" &&
    normalized[2] === "telefono" &&
    normalized[3] === "whatsapp"
  );
}

export async function importCampusesCsvAction(formData: FormData): Promise<CsvImportResult> {
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
      if (lines.length < 2) {
        return { ok: false, error: "El CSV no contiene filas de datos." };
      }
      rows = lines.map((line) => parseCsvLine(line));
    } else {
      const buffer = await file.arrayBuffer();
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(buffer as Parameters<typeof workbook.xlsx.load>[0]);
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
    const hasHeaderRow = isExpectedHeaderRow(firstRow);

    const colPlantel = 0;
    const colAddress = 1;
    const colPhone = 2;
    const colWhatsapp = 3;

    if (!hasHeaderRow && rows.some((row) => row.length < 2)) {
      return {
        ok: false,
        error: "Formato inválido. El orden esperado es: Plantel, Direccion, Telefono, Whatsapp.",
      };
    }

    const allCampuses = await prisma.campus.findMany({
      select: { id: true, code: true, metaKey: true, name: true, slug: true },
    });

    const notFound: string[] = [];
    let updated = 0;
    const startIndex = hasHeaderRow ? 1 : 0;
    const processed = Math.max(rows.length - startIndex, 0);

    for (let i = startIndex; i < rows.length; i++) {
      const cols = rows[i];
      if (cols.every((c) => !c)) continue;

      const rowPlantel = (cols[colPlantel] ?? "").trim();

      const match = allCampuses.find(
        (c) =>
          (rowPlantel && c.code.toLowerCase() === rowPlantel.toLowerCase()) ||
          (rowPlantel && c.metaKey.toLowerCase() === rowPlantel.toLowerCase()) ||
          (rowPlantel && c.slug.toLowerCase() === rowPlantel.toLowerCase()) ||
          (rowPlantel && c.name.toLowerCase() === rowPlantel.toLowerCase())
      );

      if (!match) {
        const identifier = rowPlantel || `fila ${i + 1}`;
        notFound.push(identifier);
        continue;
      }

      const address = (cols[colAddress] ?? "").trim() || null;
      const phone = (cols[colPhone] ?? "").trim() || null;
      const whatsapp = (cols[colWhatsapp] ?? "").trim() || null;

      await prisma.campus.update({
        where: { id: match.id },
        data: { address, phone, whatsapp },
      });
      updated++;
    }

    revalidatePath("/admin/unidep/campuses");
    revalidatePath("/api/public/campuses");
    revalidatePath("/unidep");
    revalidatePublicRouteTags([PUBLIC_ROUTE_CACHE_TAGS.campuses]);

    return { ok: true, processed, updated, notFound };
  } catch (err) {
    console.error("Campuses file import error:", err);
    return { ok: false, error: "Error al importar el archivo." };
  }
}
