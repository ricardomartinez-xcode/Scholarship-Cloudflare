import { ProgramOfferingDelivery } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import type {
  ImportAcademicOfferSummary,
  PreparedAcademicOfferImportPayload,
} from "./academic-offer";

export type { PreparedAcademicOfferImportPayload } from "./academic-offer";

type ParsedCampus = PreparedAcademicOfferImportPayload["parsed"][number];
type ParsedOfferRow = ParsedCampus["rows"][number];

type ProgramSeed = {
  name: string;
  level: string | null;
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
      if (!seeds.has(row.programNormalized)) {
        seeds.set(row.programNormalized, {
          name: row.programName,
          level: row.level,
        });
      }
    }
  }

  return seeds;
}

async function upsertProgramsForImport(
  seeds: Map<string, ProgramSeed>,
  summary: ImportAcademicOfferSummary,
): Promise<ProgramIdByNormalizedName> {
  const programIds = new Map<string, string>();

  for (const [nameNormalized, program] of seeds) {
    const existing = await prisma.program.findUnique({
      where: { nameNormalized },
      select: { id: true, name: true, level: true },
    });

    if (!existing) {
      const created = await prisma.program.create({
        data: {
          name: program.name,
          nameNormalized,
          level: program.level,
        },
        select: { id: true },
      });
      programIds.set(nameNormalized, created.id);
      summary.programs.created += 1;
      continue;
    }

    const nextLevel = program.level ?? existing.level;
    if (existing.name !== program.name || existing.level !== nextLevel) {
      await prisma.program.update({
        where: { id: existing.id },
        data: {
          name: program.name,
          level: nextLevel,
        },
      });
      summary.programs.updated += 1;
    }

    programIds.set(nameNormalized, existing.id);
  }

  return programIds;
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

      const key = `${payload.cycle}::${campus.campusId}::${programId}`;
      byKey.set(key, {
        campusId: campus.campusId,
        campusCode: campus.campusCode,
        campusName: campus.campusNameFromExcel ?? campus.campusCode,
        sheetName: campus.sheetName,
        source: campus.source,
        programId,
        row,
      });
    }
  }

  return Array.from(byKey.values());
}

/**
 * Applies an academic-offer import as a full replacement for the imported cycle.
 *
 * Previous behavior upserted current rows and archived missing rows, which made
 * repeated imports behave like cumulative history. For operations, each import
 * now becomes the source of truth for its cycle: existing offerings for the cycle
 * are deleted inside the same transaction and then recreated from the payload.
 */
export async function applyPreparedAcademicOfferImport(params: {
  payload: PreparedAcademicOfferImportPayload;
  updatedBy: string;
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

  const programSeeds = getProgramSeeds(params.payload);
  const programIds = await upsertProgramsForImport(programSeeds, summary);
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

    const deleted = await tx.programOffering.deleteMany({
      where: { cycle: params.payload.cycle },
    });

    if (replacementRows.length > 0) {
      const created = await tx.programOffering.createMany({
        data: replacementRows.map((item) => ({
          campusId: item.campusId,
          programId: item.programId,
          cycle: params.payload.cycle,
          delivery:
            item.row.delivery === "ONLINE"
              ? ProgramOfferingDelivery.ONLINE
              : ProgramOfferingDelivery.CAMPUS,
          escolarizado: item.row.escolarizado,
          ejecutivo: item.row.ejecutivo,
          escolarizadoSchedule: item.row.escolarizadoSchedule,
          ejecutivoSchedule: item.row.ejecutivoSchedule,
          pricingPlans: item.row.pricingPlans ?? [],
          isActive: true,
          archivedAt: null,
          archivedReason: null,
          updatedBy: params.updatedBy,
        })),
        skipDuplicates: true,
      });

      summary.offerings.created = created.count;
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
