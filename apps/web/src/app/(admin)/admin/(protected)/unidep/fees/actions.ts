"use server";

import { revalidatePath } from "next/cache";

import { requireAdminCapabilityUser } from "@/lib/admin-session";
import { prisma } from "@/lib/prisma";
import {
  PUBLIC_ROUTE_CACHE_TAGS,
  revalidatePublicRouteTags,
} from "@/lib/public-route-cache";
import {
  deleteCanonicalMateriaRow,
  getCanonicalMateriaRows,
  syncCanonicalMateriaRow,
} from "@/lib/return-subject-price-admin";
import {
  listCampusCatalog,
  resolveCampusFromCatalog,
} from "@/lib/campus-resolver";
import { normalizeKey } from "@/lib/text-normalize";
import {
  AcademicFeeSection,
  AdminCapability,
  BenefitModality,
} from "@prisma/client";

const PRICES_WRITE_CAPABILITY = AdminCapability.manage_prices;

// ─── Precio por Materia (ReturnSubjectPrice canónico) ───────────────────────

export type MateriaRow = {
  plantel: string;
  modalidad: string;
  materias_count: number;
  costo: number;
};

export async function getMateriasAction(): Promise<MateriaRow[]> {
  try {
    await requireAdminCapabilityUser(PRICES_WRITE_CAPABILITY);
    return await getCanonicalMateriaRows();
  } catch {
    return [];
  }
}

function toBenefitModality(raw: string): BenefitModality | null {
  const m = raw.trim().toLowerCase();
  if (m === "presencial") return "presencial";
  if (m === "mixta") return "mixta";
  if (m === "online") return "online";
  return null;
}

export async function upsertMateriaAction(
  formData: FormData,
): Promise<{ ok: boolean; error?: string }> {
  try {
    await requireAdminCapabilityUser(PRICES_WRITE_CAPABILITY);

    const plantelRaw = String(formData.get("plantel") ?? "").trim();
    const modalidadRaw = String(formData.get("modalidad") ?? "").trim();
    const materias_count = parseInt(String(formData.get("materias_count") ?? ""), 10);
    const costo = parseFloat(String(formData.get("costo") ?? ""));
    const origPlantel = String(formData.get("origPlantel") ?? "").trim();
    const origModalidad = String(formData.get("origModalidad") ?? "").trim();
    const origMaterias = parseInt(String(formData.get("origMaterias") ?? ""), 10);

    if (!plantelRaw || !modalidadRaw)
      return { ok: false, error: "Plantel y modalidad son requeridos." };
    if (isNaN(materias_count) || materias_count < 0)
      return { ok: false, error: "Cantidad de materias inválida." };
    if (isNaN(costo) || costo < 0) return { ok: false, error: "Costo inválido." };

    const modalidad = toBenefitModality(modalidadRaw);
    if (!modalidad) return { ok: false, error: "Modalidad inválida." };

    const result = await syncCanonicalMateriaRow({
      plantelRaw,
      modalidadRaw,
      materiasCount: materias_count,
      costo: Math.round(costo),
      origPlantel: origPlantel || undefined,
      origModalidad: origModalidad || undefined,
      origMaterias: isNaN(origMaterias) ? undefined : origMaterias,
    });
    if (!result.ok) return { ok: false, error: result.message };

    revalidatePath("/admin/unidep/fees");
    revalidatePublicRouteTags([PUBLIC_ROUTE_CACHE_TAGS.costos]);
    return { ok: true };
  } catch {
    return { ok: false, error: "No fue posible guardar." };
  }
}

export async function deleteMateriaAction(formData: FormData): Promise<void> {
  try {
    await requireAdminCapabilityUser(PRICES_WRITE_CAPABILITY);

    const plantel = String(formData.get("plantel") ?? "").trim();
    const modalidadRaw = String(formData.get("modalidad") ?? "").trim();
    const materias_count = parseInt(String(formData.get("materias_count") ?? ""), 10);

    if (!plantel || !modalidadRaw || isNaN(materias_count)) return;

    await deleteCanonicalMateriaRow({
      plantelRaw: plantel,
      modalidadRaw,
      materiasCount: materias_count,
    });

    revalidatePath("/admin/unidep/fees");
    revalidatePublicRouteTags([PUBLIC_ROUTE_CACHE_TAGS.costos]);
  } catch {
    // silent
  }
}

type ImportFormat = "json" | "csv";

function normalizeHeader(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function countDelimiterOutsideQuotes(line: string, delimiter: string) {
  let count = 0;
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        i++;
        continue;
      }
      inQuotes = !inQuotes;
      continue;
    }
    if (ch === delimiter && !inQuotes) {
      count++;
    }
  }
  return count;
}

function detectDelimiter(line: string) {
  const candidates = [",", ";", "|"] as const;
  return candidates.reduce<(typeof candidates)[number]>((best, candidate) => {
    const bestCount = countDelimiterOutsideQuotes(line, best);
    const nextCount = countDelimiterOutsideQuotes(line, candidate);
    return nextCount > bestCount ? candidate : best;
  }, ",");
}

function parseDelimitedLine(line: string, delimiter: string) {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (ch === delimiter && !inQuotes) {
      result.push(current.trim().replace(/^\uFEFF/, ""));
      current = "";
      continue;
    }

    current += ch;
  }

  result.push(current.trim().replace(/^\uFEFF/, ""));
  return result;
}

function parseDelimitedText(text: string) {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (!lines.length) return [] as string[][];
  const delimiter = detectDelimiter(lines[0] ?? "");
  return lines.map((line) => parseDelimitedLine(line, delimiter));
}

function hasExpectedHeader(row: string[], expected: string[]) {
  if (row.length < expected.length) return false;
  return expected.every(
    (header, index) => normalizeHeader(row[index] ?? "") === normalizeHeader(header),
  );
}

function findHeaderIndex(row: string[], aliases: string[]) {
  const normalizedAliases = aliases.map(normalizeHeader);
  return row.findIndex((cell) => normalizedAliases.includes(normalizeHeader(cell)));
}

function buildHeaderReader(row: string[]) {
  const codeIndex = findHeaderIndex(row, ["codigo", "código", "code", "clave", "id"]);
  const conceptIndex = findHeaderIndex(row, ["concepto", "concept", "descripcion", "descripción", "nombre"]);
  const sectionIndex = findHeaderIndex(row, ["seccion", "sección", "section", "categoria", "categoría", "tipo"]);
  const costIndex = findHeaderIndex(row, [
    "costo mxn",
    "costo",
    "cost_mxn",
    "cost mxn",
    "cost",
    "precio",
    "importe",
    "monto",
  ]);

  if ([codeIndex, conceptIndex, sectionIndex, costIndex].some((index) => index < 0)) {
    return null;
  }

  return (dataRow: string[]) => ({
    code: String(dataRow[codeIndex] ?? "").trim(),
    concept: String(dataRow[conceptIndex] ?? "").trim(),
    section: String(dataRow[sectionIndex] ?? "").trim(),
    cost_mxn: parseMxnValue(dataRow[costIndex] ?? ""),
  });
}

function getImportPayload(formData: FormData) {
  return String(formData.get("payload") ?? formData.get("json") ?? "").trim();
}

function getImportFormat(formData: FormData): ImportFormat {
  return String(formData.get("format") ?? "").trim().toLowerCase() === "csv"
    ? "csv"
    : "json";
}

function parseMxnValue(value: unknown) {
  const raw = String(value ?? "")
    .trim()
    .replace(/\$/g, "")
    .replace(/\s+/g, "");

  if (!raw) return Number.NaN;

  let normalized = raw;
  const hasComma = raw.includes(",");
  const hasDot = raw.includes(".");

  if (hasComma && hasDot) {
    normalized =
      raw.lastIndexOf(",") > raw.lastIndexOf(".")
        ? raw.replace(/\./g, "").replace(",", ".")
        : raw.replace(/,/g, "");
  } else if (hasComma) {
    const parts = raw.split(",");
    normalized =
      parts.length === 2 && parts[1] && parts[1].length <= 2
        ? `${parts[0]}.${parts[1]}`
        : raw.replace(/,/g, "");
  }

  return Number(normalized);
}

function parseCountValue(value: unknown) {
  const parsed = parseMxnValue(value);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : Number.NaN;
}

function toSection(raw: string): AcademicFeeSection | null {
  const s = raw.trim().toUpperCase();
  // Accept Spanish accented variants too
  if (s === "EXAMENES" || s === "EXÁMENES" || s === "EXAMENES") return "EXAMENES";
  if (s === "TRAMITES" || s === "TRÁMITES") return "TRAMITES";
  if (s === "DIVERSOS") return "DIVERSOS";
  return null;
}

export async function upsertFeeAction(formData: FormData) {
  try {
    await requireAdminCapabilityUser(PRICES_WRITE_CAPABILITY);

    const id = String(formData.get("id") ?? "").trim();
    const code = String(formData.get("code") ?? "").trim();
    const concept = String(formData.get("concept") ?? "").trim();
    const costMxnRaw = String(formData.get("costMxn") ?? "").trim();
    const sectionRaw = String(formData.get("section") ?? "").trim();
    const isActive = String(formData.get("isActive") ?? "true") === "true";

    if (!code) return { ok: false, error: "El código es requerido." };
    if (!concept) return { ok: false, error: "El concepto es requerido." };
    const costMxn = parseInt(costMxnRaw, 10);
    if (isNaN(costMxn) || costMxn < 0) return { ok: false, error: "El costo debe ser un entero no negativo." };

    const section = toSection(sectionRaw);
    if (!section) return { ok: false, error: "Sección inválida. Usa: EXAMENES, TRAMITES o DIVERSOS." };

    if (id) {
      await prisma.academicFee.update({
        where: { id },
        data: { code, concept, costMxn, section, isActive },
      });
    } else {
      await prisma.academicFee.create({
        data: { id: crypto.randomUUID(), code, concept, costMxn, section, isActive },
      });
    }

    revalidatePath("/admin/unidep/fees");
    revalidatePath("/api/public/costos");
    revalidatePath("/unidep");
    revalidatePublicRouteTags([PUBLIC_ROUTE_CACHE_TAGS.costos]);
    return { ok: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "";
    if (msg.includes("Unique constraint") || msg.includes("unique")) {
      return { ok: false, error: "Ya existe un trámite con ese código." };
    }
    return { ok: false, error: "No fue posible guardar el trámite." };
  }
}

export async function deleteFeeAction(formData: FormData) {
  await requireAdminCapabilityUser(PRICES_WRITE_CAPABILITY);
  const id = String(formData.get("id") ?? "").trim();
  if (!id) return;
  await prisma.academicFee.delete({ where: { id } });
  revalidatePath("/admin/unidep/fees");
  revalidatePath("/api/public/costos");
  revalidatePath("/unidep");
  revalidatePublicRouteTags([PUBLIC_ROUTE_CACHE_TAGS.costos]);
}

type SeedItem = {
  code: string;
  concept: string;
  cost_mxn: number;
  section: string;
};

export async function seedFeesJsonAction(formData: FormData) {
  try {
    await requireAdminCapabilityUser(PRICES_WRITE_CAPABILITY);

    const format = getImportFormat(formData);
    const payload = getImportPayload(formData);
    if (!payload) {
      return {
        ok: false,
        error: format === "csv" ? "CSV vacío." : "JSON vacío.",
      };
    }

    let items: SeedItem[] = [];
    if (format === "json") {
      let parsed: unknown;
      try {
        parsed = JSON.parse(payload);
      } catch {
        return { ok: false, error: "JSON inválido." };
      }

      if (Array.isArray(parsed)) {
        items = parsed as SeedItem[];
      } else if (
        parsed &&
        typeof parsed === "object" &&
        "cuotas_tramites_y_diversos" in parsed &&
        Array.isArray((parsed as Record<string, unknown>).cuotas_tramites_y_diversos)
      ) {
        items = (parsed as { cuotas_tramites_y_diversos: SeedItem[] }).cuotas_tramites_y_diversos;
      } else {
        return {
          ok: false,
          error: "JSON debe ser array o { cuotas_tramites_y_diversos: [...] }.",
        };
      }
    } else {
      const rows = parseDelimitedText(payload);
      if (!rows.length) {
        return { ok: false, error: "El CSV no contiene filas." };
      }

      const headerReader = buildHeaderReader(rows[0] ?? []);
      const hasHeader = Boolean(headerReader) || hasExpectedHeader(rows[0] ?? [], [
        "Código",
        "Concepto",
        "Sección",
        "Costo MXN",
      ]);
      const startIndex = hasHeader ? 1 : 0;
      if (rows.length <= startIndex) {
        return { ok: false, error: "El CSV no contiene filas de datos." };
      }

      items = rows
        .slice(startIndex)
        .filter((row) => row.some((cell) => String(cell ?? "").trim()))
        .map((row) =>
          headerReader
            ? headerReader(row)
            : {
                code: String(row[0] ?? "").trim(),
                concept: String(row[1] ?? "").trim(),
                section: String(row[2] ?? "").trim(),
                cost_mxn: parseMxnValue(row[3] ?? ""),
              },
        );
    }

    let created = 0;
    let updated = 0;
    const errors: string[] = [];

    for (const item of items) {
      const code = String(item.code ?? "").trim();
      const concept = String(item.concept ?? "").trim();
      const costMxn = Math.round(parseMxnValue(item.cost_mxn));
      const section = toSection(String(item.section ?? ""));

      if (!code || !concept || isNaN(costMxn) || !section) {
        errors.push(`Fila inválida: ${JSON.stringify(item)}`);
        continue;
      }

      const existing = await prisma.academicFee.findUnique({ where: { code } });
      if (existing) {
        await prisma.academicFee.update({
          where: { code },
          data: { concept, costMxn, section },
        });
        updated++;
      } else {
        await prisma.academicFee.create({
          data: { id: crypto.randomUUID(), code, concept, costMxn, section },
        });
        created++;
      }
    }

    revalidatePath("/admin/unidep/fees");
    revalidatePath("/api/public/costos");
    revalidatePath("/unidep");
    revalidatePublicRouteTags([PUBLIC_ROUTE_CACHE_TAGS.costos]);
    return { ok: true, created, updated, errors };
  } catch {
    return { ok: false, error: "Error al procesar el seed." };
  }
}

export async function upsertCampusFeeAction(formData: FormData) {
  try {
    await requireAdminCapabilityUser(PRICES_WRITE_CAPABILITY);

    const campusId = String(formData.get("campusId") ?? "").trim();
    const academicFeeId = String(formData.get("academicFeeId") ?? "").trim();
    const isActive = String(formData.get("isActive") ?? "true") === "true";
    const overrideRaw = String(formData.get("overrideCostMxn") ?? "").trim();
    const overrideCostMxn = overrideRaw ? parseInt(overrideRaw, 10) : null;

    if (!campusId || !academicFeeId)
      return { ok: false, error: "campusId y academicFeeId requeridos." };

    const existing = await prisma.campusAcademicFee.findUnique({
      where: { campusId_academicFeeId: { campusId, academicFeeId } },
    });

    if (existing) {
      await prisma.campusAcademicFee.update({
        where: { id: existing.id },
        data: {
          isActive,
          overrideCostMxn: overrideCostMxn !== null && !isNaN(overrideCostMxn) ? overrideCostMxn : null,
        },
      });
    } else {
      await prisma.campusAcademicFee.create({
        data: {
          id: crypto.randomUUID(),
          campusId,
          academicFeeId,
          isActive,
          overrideCostMxn: overrideCostMxn !== null && !isNaN(overrideCostMxn) ? overrideCostMxn : null,
        },
      });
    }

    revalidatePath("/admin/unidep/fees");
    revalidatePath("/api/public/costos");
    revalidatePath("/unidep");
    revalidatePublicRouteTags([PUBLIC_ROUTE_CACHE_TAGS.costos]);
    return { ok: true };
  } catch {
    return { ok: false, error: "Error al guardar disponibilidad." };
  }
}

type CampusFeeActivation = {
  code?: string;
  campus_code?: string;
  campus_codes?: string[];
  is_active?: boolean;
};

function buildFeeLookupKey(params: {
  concept: string;
  section: AcademicFeeSection;
  costMxn: number;
}) {
  return `${normalizeKey(params.concept)}|${params.section}|${params.costMxn}`;
}

export async function seedCampusFeesJsonAction(formData: FormData) {
  try {
    await requireAdminCapabilityUser(PRICES_WRITE_CAPABILITY);

    const format = getImportFormat(formData);
    const payload = getImportPayload(formData);
    if (!payload) {
      return {
        ok: false,
        error: format === "csv" ? "CSV vacío." : "JSON vacío.",
      };
    }

    let activated = 0;
    let deactivated = 0;
    const errors: string[] = [];

    if (format === "json") {
      let parsed: unknown;
      try {
        parsed = JSON.parse(payload);
      } catch {
        return { ok: false, error: "JSON inválido." };
      }

      if (!Array.isArray(parsed)) {
        return {
          ok: false,
          error: "JSON debe ser un array de objetos con formato { code, campus_code(s), is_active }.",
        };
      }

      const items = parsed as CampusFeeActivation[];
      for (const item of items) {
        const code = String(item.code ?? "").trim();
        const isActive = item.is_active !== false;

        if (!code) {
          errors.push(`Fila sin código: ${JSON.stringify(item)}`);
          continue;
        }

        const fee = await prisma.academicFee.findUnique({ where: { code } });
        if (!fee) {
          errors.push(`Código de costo no encontrado: ${code}`);
          continue;
        }

        let campusCodes: string[] = [];
        if (item.campus_code) {
          campusCodes = [String(item.campus_code).trim()];
        } else if (Array.isArray(item.campus_codes)) {
          campusCodes = item.campus_codes.map((campusCode) => String(campusCode).trim());
        } else {
          errors.push(`Fila sin campus_code o campus_codes: ${JSON.stringify(item)}`);
          continue;
        }

        for (const campusCode of campusCodes) {
          const campus = await prisma.campus.findUnique({ where: { code: campusCode } });
          if (!campus) {
            errors.push(`Código de plantel no encontrado: ${campusCode}`);
            continue;
          }

          const existing = await prisma.campusAcademicFee.findUnique({
            where: { campusId_academicFeeId: { campusId: campus.id, academicFeeId: fee.id } },
          });

          if (existing) {
            await prisma.campusAcademicFee.update({
              where: { id: existing.id },
              data: { isActive },
            });
          } else {
            await prisma.campusAcademicFee.create({
              data: {
                id: crypto.randomUUID(),
                campusId: campus.id,
                academicFeeId: fee.id,
                isActive,
              },
            });
          }

          if (isActive) {
            activated++;
          } else {
            deactivated++;
          }
        }
      }
    } else {
      const campusId = String(formData.get("campusId") ?? "").trim();
      if (!campusId) {
        return {
          ok: false,
          error: "Selecciona el plantel que quieres actualizar antes de importar el CSV.",
        };
      }

      const campus = await prisma.campus.findUnique({
        where: { id: campusId },
        select: { id: true, name: true },
      });
      if (!campus) {
        return { ok: false, error: "Plantel inválido para la importación." };
      }

      const rows = parseDelimitedText(payload);
      if (!rows.length) {
        return { ok: false, error: "El CSV no contiene filas." };
      }

      const hasHeader = hasExpectedHeader(rows[0] ?? [], [
        "Concepto",
        "Sección",
        "Costo base",
      ]);
      const startIndex = hasHeader ? 1 : 0;
      if (rows.length <= startIndex) {
        return { ok: false, error: "El CSV no contiene filas de datos." };
      }

      const feeLookup = new Map<string, { id: string } | null>();
      const allFees = await prisma.academicFee.findMany({
        select: { id: true, concept: true, section: true, costMxn: true },
      });

      for (const fee of allFees) {
        const key = buildFeeLookupKey({
          concept: fee.concept,
          section: fee.section,
          costMxn: fee.costMxn,
        });
        feeLookup.set(key, feeLookup.has(key) ? null : { id: fee.id });
      }

      const targetFeeIds = new Set<string>();
      let validRows = 0;

      for (let index = startIndex; index < rows.length; index++) {
        const row = rows[index] ?? [];
        if (!row.some((cell) => String(cell ?? "").trim())) continue;

        const concept = String(row[0] ?? "").trim();
        const section = toSection(String(row[1] ?? ""));
        const costMxn = Math.round(parseMxnValue(row[2] ?? ""));

        if (!concept || !section || isNaN(costMxn)) {
          errors.push(`Fila inválida ${index + 1}: ${JSON.stringify(row)}`);
          continue;
        }

        const match = feeLookup.get(
          buildFeeLookupKey({
            concept,
            section,
            costMxn,
          }),
        );

        if (match === undefined) {
          errors.push(
            `No se encontró un costo con Concepto="${concept}", Sección="${section}" y Costo base="${costMxn}" en ${campus.name}.`,
          );
          continue;
        }

        if (match === null) {
          errors.push(
            `La fila ${index + 1} es ambigua porque hay más de un costo con Concepto="${concept}", Sección="${section}" y Costo base="${costMxn}".`,
          );
          continue;
        }

        targetFeeIds.add(match.id);
        validRows++;
      }

      if (!validRows) {
        return {
          ok: false,
          error:
            "El CSV no trajo filas válidas. Revisa que el orden sea Concepto | Sección | Costo base.",
        };
      }

      const existingRows = await prisma.campusAcademicFee.findMany({
        where: { campusId: campus.id },
        select: { id: true, academicFeeId: true, isActive: true },
      });
      const existingMap = new Map(
        existingRows.map((row) => [row.academicFeeId, row] as const),
      );

      for (const academicFeeId of targetFeeIds) {
        const existing = existingMap.get(academicFeeId);
        if (existing) {
          if (!existing.isActive) {
            await prisma.campusAcademicFee.update({
              where: { id: existing.id },
              data: { isActive: true },
            });
            activated++;
          }
        } else {
          await prisma.campusAcademicFee.create({
            data: {
              id: crypto.randomUUID(),
              campusId: campus.id,
              academicFeeId,
              isActive: true,
            },
          });
          activated++;
        }
      }

      for (const existing of existingRows) {
        if (existing.isActive && !targetFeeIds.has(existing.academicFeeId)) {
          await prisma.campusAcademicFee.update({
            where: { id: existing.id },
            data: { isActive: false },
          });
          deactivated++;
        }
      }
    }

    revalidatePath("/admin/unidep/fees");
    revalidatePath("/api/public/costos");
    revalidatePath("/unidep");
    revalidatePublicRouteTags([PUBLIC_ROUTE_CACHE_TAGS.costos]);
    return { ok: true, activated, deactivated, errors };
  } catch (err) {
    console.error("seedCampusFeesJsonAction error:", err);
    return { ok: false, error: "Error al procesar el seed de disponibilidad por plantel." };
  }
}

type MateriaSeedItem = {
  plantel: string;
  modalidad: string;
  materias_count: number;
  costo: number;
};

export async function seedMateriasImportAction(formData: FormData) {
  try {
    await requireAdminCapabilityUser(PRICES_WRITE_CAPABILITY);

    const format = getImportFormat(formData);
    const payload = getImportPayload(formData);
    if (!payload) {
      return {
        ok: false,
        error: format === "csv" ? "CSV vacío." : "JSON vacío.",
      };
    }

    let items: MateriaSeedItem[] = [];
    if (format === "json") {
      let parsed: unknown;
      try {
        parsed = JSON.parse(payload);
      } catch {
        return { ok: false, error: "JSON inválido." };
      }

      if (Array.isArray(parsed)) {
        items = parsed as MateriaSeedItem[];
      } else if (
        parsed &&
        typeof parsed === "object" &&
        "precios_por_materia" in parsed &&
        Array.isArray((parsed as Record<string, unknown>).precios_por_materia)
      ) {
        items = (parsed as { precios_por_materia: MateriaSeedItem[] }).precios_por_materia;
      } else {
        return {
          ok: false,
          error: "JSON debe ser array o { precios_por_materia: [...] }.",
        };
      }
    } else {
      const rows = parseDelimitedText(payload);
      if (!rows.length) {
        return { ok: false, error: "El CSV no contiene filas." };
      }

      const hasHeader = hasExpectedHeader(rows[0] ?? [], [
        "Plantel",
        "Modalidad",
        "# Materias",
        "Costo MXN",
      ]);
      const startIndex = hasHeader ? 1 : 0;
      if (rows.length <= startIndex) {
        return { ok: false, error: "El CSV no contiene filas de datos." };
      }

      items = rows
        .slice(startIndex)
        .filter((row) => row.some((cell) => String(cell ?? "").trim()))
        .map((row) => ({
          plantel: String(row[0] ?? "").trim(),
          modalidad: String(row[1] ?? "").trim(),
          materias_count: parseCountValue(row[2] ?? ""),
          costo: parseMxnValue(row[3] ?? ""),
        }));
    }

    const campusCatalog = await listCampusCatalog();
    let created = 0;
    let updated = 0;
    const errors: string[] = [];

    for (const item of items) {
      const plantelRaw = String(item.plantel ?? "").trim();
      const modalidadRaw = String(item.modalidad ?? "").trim();
      const materiasCount = parseCountValue(item.materias_count);
      const costo = Math.round(parseMxnValue(item.costo));

      if (!plantelRaw || !modalidadRaw || isNaN(materiasCount) || materiasCount < 0 || isNaN(costo)) {
        errors.push(`Fila inválida: ${JSON.stringify(item)}`);
        continue;
      }

      const campus = resolveCampusFromCatalog(campusCatalog, plantelRaw);
      if (!campus) {
        errors.push(`Plantel no encontrado: ${plantelRaw}`);
        continue;
      }

      const modalidad = toBenefitModality(modalidadRaw);
      if (!modalidad) {
        errors.push(`Modalidad inválida: ${modalidadRaw}`);
        continue;
      }

      const result = await syncCanonicalMateriaRow({
        plantelRaw,
        modalidadRaw,
        materiasCount,
        costo,
      });
      if (result.ok && result.reason === "created") created++;
      else if (result.ok && result.reason === "updated") updated++;
      else if (!result.ok) errors.push(result.message);
    }

    revalidatePath("/admin/unidep/fees");
    revalidatePublicRouteTags([PUBLIC_ROUTE_CACHE_TAGS.costos]);
    return { ok: true, created, updated, errors };
  } catch {
    return { ok: false, error: "Error al procesar la importación de precio por materia." };
  }
}
