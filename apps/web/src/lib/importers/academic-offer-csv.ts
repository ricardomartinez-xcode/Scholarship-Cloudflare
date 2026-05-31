import { type CampusKind } from "@prisma/client";

import { type AcademicOfferCycle } from "@/config/academicOffer";
import { normalizeAcademicPricingPlans } from "@/lib/academic-offer-plans";
import { parseCsvText, normalizeHeader } from "@/lib/importers/csv-utils";
import {
  addConfiguredCampusAliasesToLookup,
  canonicalImportKey,
  loadImporterAliasRows,
  type ImporterAliasOptions,
} from "@/lib/importers/configured-aliases";
import { prisma } from "@/lib/prisma";
import { normalizeKey } from "@/lib/text-normalize";
import type {
  AcademicOfferPreviewRow,
  ImportAcademicOfferSummary,
  PreparedAcademicOfferImportPayload,
} from "@/lib/importers/academic-offer";

type ParsedRow = {
  programName: string;
  programNormalized: string;
  level: string | null;
  escolarizado: boolean;
  ejecutivo: boolean;
  escolarizadoSchedule: string | null;
  ejecutivoSchedule: string | null;
  delivery: "CAMPUS" | "ONLINE";
  pricingPlans: number[] | null;
};

type CampusParseResult = {
  campusId: string;
  campusCode: string;
  sheetName: string;
  campusNameFromExcel: string | null;
  rows: ParsedRow[];
  source: "campus-sheet" | "online-sheet";
};

type CsvRecord = Record<string, string>;

type ExtendedPreviewRow = AcademicOfferPreviewRow & {
  campusId: string;
  programId: string;
  delivery: "CAMPUS" | "ONLINE";
  escolarizado: boolean;
  ejecutivo: boolean;
  escolarizadoSchedule: string | null;
  ejecutivoSchedule: string | null;
};

const COLUMNS = {
  campus: ["plantel", "campus", "sede", "codigoplantel", "campuscode"],
  program: ["programa", "carrera", "plandeestudios", "programname"],
  level: ["nivel", "linea", "lineadenegocio", "categoria"],
  modality: ["modalidad", "delivery", "tipo"],
  escolarizado: ["escolarizado", "escolar", "presencial"],
  ejecutivo: ["ejecutivo", "ejec"],
  escolarizadoSchedule: ["horarioescolarizado", "horarioescolar", "horario"],
  ejecutivoSchedule: ["horarioejecutivo", "horarioejec"],
  plans: ["planes", "plan", "cuatrimestres", "duracion"],
} as const;

function recordsFromCsv(rows: string[][]): CsvRecord[] {
  const headers = rows[0]?.map((header) => normalizeHeader(header)) ?? [];
  return rows.slice(1).map((row) => {
    const record: CsvRecord = {};
    headers.forEach((header, index) => {
      if (header) record[header] = String(row[index] ?? "").trim();
    });
    return record;
  });
}

function get(record: CsvRecord, aliases: readonly string[]) {
  for (const alias of aliases) {
    const key = normalizeHeader(alias);
    if (record[key]) {
      return record[key].trim();
    }
  }
  return "";
}

function truthy(raw: string) {
  const value = normalizeKey(raw);
  return ["1", "si", "sí", "true", "verdadero", "yes", "x"].includes(value);
}

function isOnline(campusRaw: string, modalityRaw: string) {
  const campus = normalizeKey(campusRaw);
  const modality = normalizeKey(modalityRaw);
  return ["online", "on", "linea"].includes(campus) || ["online", "on", "linea"].includes(modality) || modality.includes("online");
}

function modalityLabel(row: ParsedRow) {
  if (row.delivery === "ONLINE") return "Online";
  if (row.escolarizado && row.ejecutivo) return "Escolarizado / Ejecutivo";
  if (row.ejecutivo) return "Ejecutivo";
  if (row.escolarizado) return "Escolarizado";
  return "Presencial";
}

function lineForRow(row: ParsedRow, programLine: string | null) {
  if (programLine) return programLine;
  const level = normalizeKey(row.level ?? "");
  if (level.includes("posgrado")) return "posgrado";
  if (level.includes("prepa") || level.includes("bachiller")) return "prepa";
  return "licenciatura";
}

export async function prepareAcademicOfferCsvImport(params: {
  buffer: Uint8Array;
  fileName?: string;
  cycle: AcademicOfferCycle;
} & ImporterAliasOptions): Promise<{
  summary: ImportAcademicOfferSummary;
  previewRows: ExtendedPreviewRow[];
  payload: PreparedAcademicOfferImportPayload;
}> {
  const csvRows = parseCsvText(Buffer.from(params.buffer).toString("utf8"));
  if (csvRows.length < 2) {
    throw new Error("El CSV de oferta académica necesita encabezados y al menos una fila.");
  }

  const records = recordsFromCsv(csvRows);
  const aliasRows = await loadImporterAliasRows(params);
  const campuses = await prisma.campus.findMany({
    where: { isActive: true },
    select: { id: true, code: true, name: true, metaKey: true, kind: true },
  });

  const campusByKey = new Map<string, { id: string; code: string; name: string; metaKey: string; kind: CampusKind }>();
  for (const campus of campuses) {
    campusByKey.set(normalizeKey(campus.metaKey), campus);
    campusByKey.set(normalizeKey(campus.name), campus);
    campusByKey.set(normalizeKey(campus.code), campus);
  }
  addConfiguredCampusAliasesToLookup(campusByKey, aliasRows);

  const onlineCampus = campuses.find((campus) => campus.code === "ONLINE");
  if (!onlineCampus) throw new Error('No existe Campus code="ONLINE" en la BD.');

  const parsedByCampus = new Map<string, CampusParseResult>();
  const unknownCampuses = new Set<string>();

  for (const record of records) {
    const programName = get(record, COLUMNS.program);
    if (!programName) continue;

    const campusRaw = get(record, COLUMNS.campus);
    const modalityRaw = get(record, COLUMNS.modality);
    const online = isOnline(campusRaw, modalityRaw);
    const campus = online ? onlineCampus : campusByKey.get(canonicalImportKey(aliasRows, "campus", campusRaw) ?? normalizeKey(campusRaw));

    if (!campus) {
      unknownCampuses.add(campusRaw || "Sin plantel");
      continue;
    }

    const programNormalized = canonicalImportKey(aliasRows, "program", programName) ?? normalizeKey(programName);
    const modality = normalizeKey(modalityRaw);
    const escolarizadoRaw = get(record, COLUMNS.escolarizado);
    const ejecutivoRaw = get(record, COLUMNS.ejecutivo);
    const escolarizado = online ? false : truthy(escolarizadoRaw) || modality.includes("escolarizado") || (!ejecutivoRaw && !modalityRaw);
    const ejecutivo = online ? false : truthy(ejecutivoRaw) || modality.includes("ejecutivo");
    const row: ParsedRow = {
      programName,
      programNormalized,
      level: get(record, COLUMNS.level) || null,
      escolarizado,
      ejecutivo,
      escolarizadoSchedule: get(record, COLUMNS.escolarizadoSchedule) || null,
      ejecutivoSchedule: get(record, COLUMNS.ejecutivoSchedule) || null,
      delivery: online ? "ONLINE" : "CAMPUS",
      pricingPlans: normalizeAcademicPricingPlans(get(record, COLUMNS.plans)),
    };

    const existing = parsedByCampus.get(campus.id) ?? {
      campusId: campus.id,
      campusCode: campus.code,
      sheetName: "CSV",
      campusNameFromExcel: online ? null : campusRaw || campus.name,
      rows: [],
      source: online ? "online-sheet" : "campus-sheet",
    };
    existing.rows.push(row);
    parsedByCampus.set(campus.id, existing);
  }

  const parsed = Array.from(parsedByCampus.values());
  if (!parsed.length) throw new Error("El CSV no contiene filas válidas de oferta académica.");

  const warnings: string[] = [];
  if (unknownCampuses.size) warnings.push(`Planteles no reconocidos en BD (se omitieron): ${Array.from(unknownCampuses).join(", ")}`);

  const programsByNormalized = new Map<string, { name: string; level: string | null }>();
  for (const campusRes of parsed) {
    for (const row of campusRes.rows) programsByNormalized.set(row.programNormalized, { name: row.programName, level: row.level });
  }

  const existingPrograms = await prisma.program.findMany({
    where: { nameNormalized: { in: Array.from(programsByNormalized.keys()) } },
    select: { id: true, name: true, nameNormalized: true, level: true, businessLine: true, planPdfUrl: true, brochurePdfUrl: true, planDriveLink: true, planUrl: true },
  });
  const existingProgramByKey = new Map(existingPrograms.map((program) => [program.nameNormalized, program]));

  const existingOfferings = await prisma.programOffering.findMany({
    where: { cycle: params.cycle, campusId: { in: parsed.map((campusRes) => campusRes.campusId) } },
    select: { campusId: true, isActive: true, pricingPlans: true, program: { select: { nameNormalized: true } } },
  });
  const offeringsByCampus = new Map<string, Array<{ nameNormalized: string; isActive: boolean; pricingPlans: number[] }>>();
  for (const offering of existingOfferings) {
    const rows = offeringsByCampus.get(offering.campusId) ?? [];
    rows.push({ nameNormalized: offering.program.nameNormalized, isActive: offering.isActive, pricingPlans: offering.pricingPlans ?? [] });
    offeringsByCampus.set(offering.campusId, rows);
  }

  const summary: ImportAcademicOfferSummary = {
    ok: true,
    cycle: params.cycle,
    campusesProcessed: parsed.length,
    programs: { created: 0, updated: 0 },
    offerings: { created: 0, updated: 0, reactivated: 0, deactivated: 0 },
    warnings,
    detectedSheets: { online: "CSV", planteles: "CSV" },
    detectedColumns: null,
    perCampus: [],
  };

  for (const [nameNormalized, program] of programsByNormalized) {
    const existing = existingProgramByKey.get(nameNormalized);
    if (!existing) summary.programs.created += 1;
    else if (existing.name !== program.name || existing.level !== (program.level ?? existing.level)) summary.programs.updated += 1;
  }

  const previewRows: ExtendedPreviewRow[] = [];
  for (const campusRes of parsed) {
    const existingByProgram = new Map((offeringsByCampus.get(campusRes.campusId) ?? []).map((offering) => [offering.nameNormalized, offering.isActive]));
    const excelKeys = new Set<string>();
    let created = 0;
    let updated = 0;
    let reactivated = 0;

    for (const row of campusRes.rows) {
      excelKeys.add(row.programNormalized);
      const previous = existingByProgram.get(row.programNormalized);
      if (previous === undefined) created += 1;
      else if (!previous) reactivated += 1;
      else updated += 1;

      if (previewRows.length < 400) {
        const program = existingProgramByKey.get(row.programNormalized);
        const line = lineForRow(row, program?.businessLine ?? null);
        const previousPlans = (offeringsByCampus.get(campusRes.campusId) ?? []).find((offering) => offering.nameNormalized === row.programNormalized)?.pricingPlans ?? [];
        previewRows.push({
          id: `${campusRes.campusId}:${row.programNormalized}`,
          campusId: campusRes.campusId,
          programId: program?.id ?? "",
          campusCode: campusRes.campusCode,
          campusName: campusRes.campusNameFromExcel ?? campusRes.campusCode,
          cycle: params.cycle,
          programName: row.programName,
          line,
          modality: modalityLabel(row),
          pricingPlans: row.pricingPlans ?? previousPlans,
          delivery: row.delivery,
          escolarizado: row.escolarizado,
          ejecutivo: row.ejecutivo,
          escolarizadoSchedule: row.escolarizadoSchedule,
          ejecutivoSchedule: row.ejecutivoSchedule,
          isActive: true,
          hasPlanPdf: Boolean(program?.planPdfUrl ?? program?.planDriveLink ?? program?.planUrl),
          hasBrochurePdf: Boolean(program?.brochurePdfUrl),
        });
      }
    }

    const deactivated = (offeringsByCampus.get(campusRes.campusId) ?? []).filter((offering) => offering.isActive && !excelKeys.has(offering.nameNormalized)).length;
    summary.offerings.created += created;
    summary.offerings.updated += updated;
    summary.offerings.reactivated += reactivated;
    summary.offerings.deactivated += deactivated;
    summary.perCampus.push({
      campusCode: campusRes.campusCode,
      campusName: campusRes.campusNameFromExcel ?? campusRes.campusCode,
      sheetName: campusRes.sheetName,
      source: campusRes.source,
      rows: campusRes.rows.length,
      offeringsCreated: created,
      offeringsUpdated: updated,
      offeringsReactivated: reactivated,
      offeringsDeactivated: deactivated,
    });
  }

  return {
    summary,
    previewRows,
    payload: {
      cycle: params.cycle,
      warnings,
      detectedSheets: summary.detectedSheets,
      detectedColumns: null,
      parsed,
    },
  };
}
