import { ProgramOfferingDelivery } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import type {
  ImportAcademicOfferSummary,
  PreparedAcademicOfferImportPayload,
} from "./academic-offer";

export type { PreparedAcademicOfferImportPayload } from "./academic-offer";

export type AcademicOfferImportApplyMode = "replace" | "update-only";

type ParsedCampus = PreparedAcademicOfferImportPayload["parsed"][number];
type ParsedOfferRow = ParsedCampus["rows"][number];

type ProgramSeed = {
  name: string;
  level: string | null;
  lineOfBusiness: ParsedOfferRow["lineOfBusiness"];
};

type ProgramIdByNormalizedName = Map<string, string>;

type ReplacementOfferRow = {
  campusId: string;
  campusCode: string;
  campusName: string;
  sheetName: string;
  source: ParsedCampus["source"];
  programId: string;
  row: ParsedOfferRow;
};

function getProgramSeeds(payload: PreparedAcademicOfferImportPayload) {
  const seeds = new Map<string, ProgramSeed>();

  for (const campus of payload.parsed) {
    for (const row of campus.rows) {
      const existing = seeds.get(row.programNormalized);
      if (!existing) {
        seeds.set(row.programNormalized, {
          name: row.programName,
          level: row.level,
          lineOfBusiness: row.lineOfBusiness,
        });
        continue;
      }

      if (!existing.level && row.level) {
        existing.level = row.level;
      }
      if (!existing.lineOfBusiness && row.lineOfBusiness) {
        existing.lineOfBusiness = row.lineOfBusiness;
      }
    }
  }

  return seeds;
}

async function upsertProgramsForImport(
  seeds: Map<string, ProgramSeed>,
  summary: ImportAcademicOfferSummary,
  options?: { allowCreate?: boolean },
): Promise<ProgramIdByNormalizedName> {
  const programIds = new Map<string, string>();

  for (const [nameNormalized, program] of seeds) {
    const existing = await prisma.program.findUnique({
      where: { nameNormalized },
      select: { id: true, name: true, level: true, businessLine: true },
    });

    if (!existing) {
      if (options?.allowCreate === false) {
        throw new Error(`Actualizar lote no puede crear programas nuevos: ${program.name}.`);
      }

      const created = await prisma.program.create({
        data: {
          name: program.name,
          nameNormalized,
          level: program.level,
          businessLine: program.lineOfBusiness,
        },
        select: { id: true },
      });
      programIds.set(nameNormalized, created.id);
      summary.programs.created += 1;
      continue;
    }

    const nextLevel = program.level ?? existing.level;
    const nextBusinessLine = program.lineOfBusiness ?? existing.businessLine;
    if (
      existing.name !== program.name ||
      existing.level !== nextLevel ||
      existing.businessLine !== nextBusinessLine
    ) {
      await prisma.program.update({
        where: { id: existing.id },
        data: {
          name: program.name,
          level: nextLevel,
          businessLine: nextBusinessLine,
        },
      });
      summary.programs.updated += 1;
    }

    programIds.set(nameNormalized, existing.id);
  }

  return programIds;
}

function mergePricingPlans(
  left: number[] | null,
  right: number[] | null,
): number[] | null {
  if (left === null && right === null) return null;
  return Array.from(new Set([...(left ?? []), ...(right ?? [])])).sort((a, b) => a - b);
}

function mergeText(left: string | null, right: string | null) {
  if (!left?.trim()) return right?.trim() ? right : null;
  if (!right?.trim() || left === right) return left;
  return `${left} | ${right}`;
}

function mergeOfferRows(previous: ParsedOfferRow, next: ParsedOfferRow): ParsedOfferRow {
  return {
    ...previous,
    programName: previous.programName || next.programName,
    programNormalized: previous.programNormalized || next.programNormalized,
    level: previous.level ?? next.level,
    lineOfBusiness: previous.lineOfBusiness ?? next.lineOfBusiness,
    delivery: previous.delivery === "ONLINE" || next.delivery === "ONLINE" ? "ONLINE" : "CAMPUS",
    escolarizado: previous.escolarizado || next.escolarizado,
    ejecutivo: previous.ejecutivo || next.ejecutivo,
    escolarizadoSchedule: mergeText(previous.escolarizadoSchedule, next.escolarizadoSchedule),
    ejecutivoSchedule: mergeText(previous.ejecutivoSchedule, next.ejecutivoSchedule),
    pricingPlans: mergePricingPlans(previous.pricingPlans, next.pricingPlans),
    module: previous.module || next.module,
    moduleCount: previous.moduleCount ?? next.moduleCount,
    subjectsByModule: mergeText(previous.subjectsByModule, next.subjectsByModule),
  };
}

function buildReplacementOfferRows(
  payload: PreparedAcademicOfferImportPayload,
  programIds: ProgramIdByNormalizedName,
): ReplacementOfferRow[] {
  const byKey = new Map<string, ReplacementOfferRow>();

  for (const campus of payload.parsed) {
    for (const row of campus.rows) {
      const programId = programIds.get(row.programNormalized);
      if (!programId) continue;

      // La llave natural del schema es ciclo + campus + programa + track.
      // El CSV C3 puede traer la misma oferta en dos filas, una presencial y otra ejecutivo.
      // Esas filas NO son duplicados de negocio: deben fusionarse en una sola oferta con
      // escolarizado/ejecutivo y sus horarios, no pisarse con last-write-wins.
      const key = `${payload.cycle}::${campus.campusId}::${programId}::${row.module}`;
      const previous = byKey.get(key);

      if (!previous) {
        byKey.set(key, {
          campusId: campus.campusId,
          campusCode: campus.campusCode,
          campusName: campus.campusNameFromExcel ?? campus.campusCode,
          sheetName: campus.sheetName,
          source: campus.source,
          programId,
          row,
        });
        continue;
      }

      previous.row = mergeOfferRows(previous.row, row);
    }
  }

  return Array.from(byKey.values());
}

/**
 * Applies an academic-offer import as a full replacement for the imported cycle.
 *
 * The importer UI stores a prepared payload after validation. Applying the session must
 * use that payload as source of truth. For C3 and future cycle templates, multiple CSV
 * rows may describe one logical offering: for example one row for presencial and one
 * row for ejecutivo, both sharing cycle + campus + program + module. The Prisma model
 * stores those modalities as flags/schedules on the same ProgramOffering, so this file
 * merges those rows before delete/createMany.
 */
export async function applyPreparedAcademicOfferImport(params: {
  payload: PreparedAcademicOfferImportPayload;
  updatedBy: string;
  mode?: AcademicOfferImportApplyMode;
}): Promise<ImportAcademicOfferSummary> {
  const summary: ImportAcademicOfferSummary = {
    ok: true,
    cycle: params.payload.cycle,
    campusesProcessed: 0,
    programs: { created: 0, updated: 0 },
    offerings: { created: 0, updated: 0, reactivated: 0, deactivated: 0 },
    warnings: [...params.payload.warnings],
    detectedSheets: params.payload.detectedSheets,
    detectedColumns: params.payload.detectedColumns,
    perCampus: [],
  };

  const mode = params.mode ?? "replace";
  const programSeeds = getProgramSeeds(params.payload);
  const programIds = await upsertProgramsForImport(programSeeds, summary, {
    allowCreate: mode !== "update-only",
  });
  const replacementRows = buildReplacementOfferRows(params.payload, programIds);

  await prisma.$transaction(async (tx) => {
    const previousCountsByCampus = new Map<string, number>();
    for (const campus of params.payload.parsed) {
      const count = await tx.programOffering.count({
        where: {
          campusId: campus.campusId,
          cycle: params.payload.cycle,
        },
      });
      previousCountsByCampus.set(campus.campusId, count);
    }

    for (const campus of params.payload.parsed) {
      if (campus.source === "campus-sheet" && campus.campusNameFromExcel) {
        await tx.campus.update({
          where: { id: campus.campusId },
          data: { name: campus.campusNameFromExcel },
        });
      }
    }

    if (mode === "update-only") {
      const updatedByCampus = new Map<string, number>();

      for (const item of replacementRows) {
        const existing = await tx.programOffering.findFirst({
          where: {
            cycle: params.payload.cycle,
            campusId: item.campusId,
            programId: item.programId,
            track: item.row.module,
          },
          select: { id: true },
        });

        if (!existing) {
          throw new Error(
            `Actualizar lote no puede crear oferta nueva: ${item.campusName} - ${item.row.programName} - ${item.row.module}.`,
          );
        }

        const isOnline = item.row.delivery === "ONLINE";
        await tx.programOffering.update({
          where: { id: existing.id },
          data: {
            delivery: isOnline
              ? ProgramOfferingDelivery.ONLINE
              : ProgramOfferingDelivery.CAMPUS,
            escolarizado: isOnline ? false : item.row.escolarizado,
            ejecutivo: isOnline ? false : item.row.ejecutivo,
            escolarizadoSchedule: isOnline ? null : item.row.escolarizadoSchedule,
            ejecutivoSchedule: isOnline ? null : item.row.ejecutivoSchedule,
            lineOfBusiness: item.row.lineOfBusiness,
            pricingPlans: item.row.pricingPlans ?? [],
            track: item.row.module,
            moduleCount: item.row.moduleCount,
            subjectsByModule: item.row.subjectsByModule,
            isActive: true,
            archivedAt: null,
            archivedReason: null,
            updatedBy: params.updatedBy,
          },
        });

        summary.offerings.updated += 1;
        updatedByCampus.set(item.campusId, (updatedByCampus.get(item.campusId) ?? 0) + 1);
      }

      summary.campusesProcessed = params.payload.parsed.length;
      for (const campus of params.payload.parsed) {
        summary.perCampus.push({
          campusCode: campus.campusCode,
          campusName: campus.campusNameFromExcel ?? campus.campusCode,
          sheetName: campus.sheetName,
          source: campus.source,
          rows: campus.rows.length,
          offeringsCreated: 0,
          offeringsUpdated: updatedByCampus.get(campus.campusId) ?? 0,
          offeringsReactivated: 0,
          offeringsDeactivated: 0,
        });
      }

      return;
    }

    const deleted = await tx.programOffering.deleteMany({
      where: { cycle: params.payload.cycle },
    });

    if (replacementRows.length > 0) {
      const created = await tx.programOffering.createMany({
        data: replacementRows.map((item) => {
          const isOnline = item.row.delivery === "ONLINE";
          return {
            campusId: item.campusId,
            programId: item.programId,
            cycle: params.payload.cycle,
            delivery: isOnline
              ? ProgramOfferingDelivery.ONLINE
              : ProgramOfferingDelivery.CAMPUS,
            escolarizado: isOnline ? false : item.row.escolarizado,
            ejecutivo: isOnline ? false : item.row.ejecutivo,
            escolarizadoSchedule: isOnline ? null : item.row.escolarizadoSchedule,
            ejecutivoSchedule: isOnline ? null : item.row.ejecutivoSchedule,
            lineOfBusiness: item.row.lineOfBusiness,
            pricingPlans: item.row.pricingPlans ?? [],
            track: item.row.module,
            moduleCount: item.row.moduleCount,
            subjectsByModule: item.row.subjectsByModule,
            isActive: true,
            archivedAt: null,
            archivedReason: null,
            updatedBy: params.updatedBy,
          };
        }),
        skipDuplicates: true,
      });

      summary.offerings.created = created.count;
      if (created.count !== replacementRows.length) {
        summary.warnings.push(
          `Se omitieron ${replacementRows.length - created.count} ofertas duplicadas por restricción única.`,
        );
      }
    }

    summary.offerings.deactivated = deleted.count;
    summary.campusesProcessed = params.payload.parsed.length;

    const createdByCampus = new Map<string, number>();
    for (const row of replacementRows) {
      createdByCampus.set(row.campusId, (createdByCampus.get(row.campusId) ?? 0) + 1);
    }

    for (const campus of params.payload.parsed) {
      summary.perCampus.push({
        campusCode: campus.campusCode,
        campusName: campus.campusNameFromExcel ?? campus.campusCode,
        sheetName: campus.sheetName,
        source: campus.source,
        rows: campus.rows.length,
        offeringsCreated: createdByCampus.get(campus.campusId) ?? 0,
        offeringsUpdated: 0,
        offeringsReactivated: 0,
        offeringsDeactivated: previousCountsByCampus.get(campus.campusId) ?? 0,
      });
    }
  });

  return summary;
}
