import { normalizeAcademicProgramName } from "@relead/db/program-name-normalization";

import { prisma } from "@/lib/prisma";

type ProgramDedupeCount = {
  offerings?: number | null;
  quoteScenarios?: number | null;
  assetChecks?: number | null;
  fileAssets?: number | null;
};

export type ProgramDedupeCandidate = {
  id: string;
  name: string;
  nameNormalized: string;
  level: string | null;
  category: string | null;
  businessLine: string | null;
  planPdfUrl: string | null;
  planDriveLink: string | null;
  planUrl: string | null;
  brochurePdfUrl: string | null;
  _count: ProgramDedupeCount;
};

export type ProgramDedupePlanGroup = {
  canonicalKey: string;
  canonicalName: string;
  canonicalId: string;
  duplicateIds: string[];
  duplicateNames: string[];
};

export type AcademicProgramDedupePlan = {
  groups: ProgramDedupePlanGroup[];
  orphanExtraIds: string[];
  programsToDelete: number;
};

type DedupeApplyCounters = {
  programsDeleted: number;
  offeringsMoved: number;
  offeringsMerged: number;
  quoteScenariosMoved: number;
  assetChecksMoved: number;
  assetChecksDeleted: number;
  fileAssetUsagesMoved: number;
  fileAssetUsagesDeleted: number;
};

export type AcademicProgramDedupeResult = AcademicProgramDedupePlan & {
  applied: boolean;
  counters: DedupeApplyCounters;
};

export type ProgramNameNormalizationCandidate = Pick<
  ProgramDedupeCandidate,
  "id" | "name" | "nameNormalized" | "level" | "category" | "businessLine"
>;

export type ProgramNameNormalizationPlanItem = {
  id: string;
  currentName: string;
  currentNameNormalized: string;
  nextName: string;
  nextNameNormalized: string;
};

export type ProgramNameNormalizationConflict = {
  nextNameNormalized: string;
  nextName: string;
  programIds: string[];
  programNames: string[];
};

export type AcademicProgramNameNormalizationPlan = {
  renames: ProgramNameNormalizationPlanItem[];
  conflicts: ProgramNameNormalizationConflict[];
  programsToUpdate: number;
};

export type AcademicProgramNameNormalizationResult = AcademicProgramNameNormalizationPlan & {
  applied: boolean;
  counters: {
    programsUpdated: number;
  };
};

const emptyCounters = (): DedupeApplyCounters => ({
  programsDeleted: 0,
  offeringsMoved: 0,
  offeringsMerged: 0,
  quoteScenariosMoved: 0,
  assetChecksMoved: 0,
  assetChecksDeleted: 0,
  fileAssetUsagesMoved: 0,
  fileAssetUsagesDeleted: 0,
});

function countValue(counts: ProgramDedupeCount, key: keyof ProgramDedupeCount) {
  return Number(counts[key] ?? 0);
}

function hasProgramAsset(program: ProgramDedupeCandidate) {
  return Boolean(
    program.planPdfUrl ||
      program.planDriveLink ||
      program.planUrl ||
      program.brochurePdfUrl ||
      countValue(program._count, "fileAssets") > 0 ||
      countValue(program._count, "assetChecks") > 0,
  );
}

function programScore(program: ProgramDedupeCandidate, canonicalKey: string) {
  return (
    countValue(program._count, "offerings") * 1000 +
    countValue(program._count, "quoteScenarios") * 100 +
    countValue(program._count, "fileAssets") * 20 +
    countValue(program._count, "assetChecks") * 10 +
    (program.nameNormalized === canonicalKey ? 8 : 0) +
    (program.businessLine ? 4 : 0) +
    (program.level ? 2 : 0) +
    (hasProgramAsset(program) ? 1 : 0)
  );
}

function isOrphanExtra(program: ProgramDedupeCandidate) {
  return (
    countValue(program._count, "offerings") === 0 &&
    countValue(program._count, "quoteScenarios") === 0 &&
    !hasProgramAsset(program)
  );
}

export function buildAcademicProgramDedupePlan(
  programs: ReadonlyArray<ProgramDedupeCandidate>,
  options: { includeOrphanExtras?: boolean } = {},
): AcademicProgramDedupePlan {
  const groupsByKey = new Map<string, ProgramDedupeCandidate[]>();

  for (const program of programs) {
    const normalized = normalizeAcademicProgramName(program.name || program.nameNormalized);
    const key = normalized.nameNormalized || program.nameNormalized;
    if (!key) continue;

    const group = groupsByKey.get(key) ?? [];
    group.push(program);
    groupsByKey.set(key, group);
  }

  const groups: ProgramDedupePlanGroup[] = [];
  const orphanExtraIds: string[] = [];

  for (const [canonicalKey, group] of groupsByKey) {
    const canonicalName = normalizeAcademicProgramName(group[0]?.name ?? canonicalKey).name;
    if (group.length === 1) {
      const only = group[0];
      if (options.includeOrphanExtras && only && isOrphanExtra(only)) {
        orphanExtraIds.push(only.id);
      }
      continue;
    }

    const sorted = [...group].sort((left, right) => {
      const scoreDiff = programScore(right, canonicalKey) - programScore(left, canonicalKey);
      if (scoreDiff !== 0) return scoreDiff;
      return left.name.localeCompare(right.name, "es");
    });
    const [canonical, ...duplicates] = sorted;
    if (!canonical || duplicates.length === 0) continue;

    groups.push({
      canonicalKey,
      canonicalName,
      canonicalId: canonical.id,
      duplicateIds: duplicates.map((program) => program.id),
      duplicateNames: duplicates.map((program) => program.name),
    });
  }

  groups.sort((left, right) => left.canonicalName.localeCompare(right.canonicalName, "es"));
  orphanExtraIds.sort();

  return {
    groups,
    orphanExtraIds,
    programsToDelete:
      groups.reduce((total, group) => total + group.duplicateIds.length, 0) +
      orphanExtraIds.length,
  };
}

export function buildAcademicProgramNameNormalizationPlan(
  programs: ReadonlyArray<ProgramNameNormalizationCandidate>,
): AcademicProgramNameNormalizationPlan {
  const normalizedPrograms = programs.map((program) => {
    const normalized = normalizeAcademicProgramName(program.name || program.nameNormalized, {
      level: [program.level, program.category].filter(Boolean).join(" "),
      businessLine: program.businessLine,
    });

    return {
      program,
      nextName: normalized.name,
      nextNameNormalized: normalized.nameNormalized,
      changed:
        program.name !== normalized.name ||
        program.nameNormalized !== normalized.nameNormalized,
    };
  });

  const byNextKey = new Map<string, typeof normalizedPrograms>();
  for (const item of normalizedPrograms) {
    const group = byNextKey.get(item.nextNameNormalized) ?? [];
    group.push(item);
    byNextKey.set(item.nextNameNormalized, group);
  }

  const conflictKeys = new Set<string>();
  const conflicts: ProgramNameNormalizationConflict[] = [];
  for (const [nextNameNormalized, group] of byNextKey) {
    if (group.length <= 1) continue;
    conflictKeys.add(nextNameNormalized);
    conflicts.push({
      nextNameNormalized,
      nextName: group[0]?.nextName ?? nextNameNormalized,
      programIds: group.map((item) => item.program.id),
      programNames: group.map((item) => item.program.name),
    });
  }

  const renames = normalizedPrograms
    .filter((item) => item.changed && !conflictKeys.has(item.nextNameNormalized))
    .map((item) => ({
      id: item.program.id,
      currentName: item.program.name,
      currentNameNormalized: item.program.nameNormalized,
      nextName: item.nextName,
      nextNameNormalized: item.nextNameNormalized,
    }));

  return {
    renames,
    conflicts,
    programsToUpdate: renames.length,
  };
}

async function listProgramCandidates(): Promise<ProgramDedupeCandidate[]> {
  const [programs, fileUsageRows] = await Promise.all([
    prisma.program.findMany({
      orderBy: [{ name: "asc" }],
      select: {
        id: true,
        name: true,
        nameNormalized: true,
        level: true,
        category: true,
        businessLine: true,
        planPdfUrl: true,
        planDriveLink: true,
        planUrl: true,
        brochurePdfUrl: true,
        _count: {
          select: {
            offerings: true,
            quoteScenarios: true,
            assetChecks: true,
          },
        },
      },
    }),
    prisma.$queryRaw<Array<{ targetId: string; count: bigint }>>`
      SELECT "target_id" AS "targetId", COUNT(*)::bigint AS "count"
      FROM "recalc_admin"."file_asset_usage"
      WHERE "target_type" = 'program'
      GROUP BY "target_id"
    `,
  ]);

  const fileAssetsByProgramId = new Map(
    fileUsageRows.map((row) => [row.targetId, Number(row.count)]),
  );

  return programs.map((program) => ({
    ...program,
    _count: {
      ...program._count,
      fileAssets: fileAssetsByProgramId.get(program.id) ?? 0,
    },
  }));
}

function mergePricingPlans(left: number[], right: number[]) {
  return Array.from(new Set([...left, ...right])).sort((a, b) => a - b);
}

async function mergeDuplicateProgramIntoCanonical(
  tx: typeof prisma,
  duplicateId: string,
  canonicalId: string,
  counters: DedupeApplyCounters,
) {
  const duplicateOfferings = await tx.programOffering.findMany({
    where: { programId: duplicateId },
  });

  for (const offering of duplicateOfferings) {
    const existing = await tx.programOffering.findFirst({
      where: {
        campusId: offering.campusId,
        programId: canonicalId,
        cycle: offering.cycle,
        track: offering.track,
      },
    });

    if (existing) {
      await tx.programOffering.update({
        where: { id: existing.id },
        data: {
          isActive: existing.isActive || offering.isActive,
          escolarizado: existing.escolarizado || offering.escolarizado,
          ejecutivo: existing.ejecutivo || offering.ejecutivo,
          escolarizadoSchedule: existing.escolarizadoSchedule ?? offering.escolarizadoSchedule,
          ejecutivoSchedule: existing.ejecutivoSchedule ?? offering.ejecutivoSchedule,
          lineOfBusiness: existing.lineOfBusiness ?? offering.lineOfBusiness,
          pricingPlans: mergePricingPlans(existing.pricingPlans, offering.pricingPlans),
          moduleCount: existing.moduleCount ?? offering.moduleCount,
          subjectsByModule: existing.subjectsByModule ?? offering.subjectsByModule,
        },
      });
      await tx.programOffering.delete({ where: { id: offering.id } });
      counters.offeringsMerged += 1;
    } else {
      await tx.programOffering.update({
        where: { id: offering.id },
        data: { programId: canonicalId },
      });
      counters.offeringsMoved += 1;
    }
  }

  const scenarioResult = await tx.quoteScenario.updateMany({
    where: { programId: duplicateId },
    data: { programId: canonicalId },
  });
  counters.quoteScenariosMoved += scenarioResult.count;

  const duplicateChecks = await tx.programAssetCheck.findMany({
    where: { programId: duplicateId },
  });
  for (const check of duplicateChecks) {
    const existing = await tx.programAssetCheck.findUnique({
      where: {
        programId_assetType: {
          programId: canonicalId,
          assetType: check.assetType,
        },
      },
    });

    if (existing) {
      await tx.programAssetCheck.delete({ where: { id: check.id } });
      counters.assetChecksDeleted += 1;
    } else {
      await tx.programAssetCheck.update({
        where: { id: check.id },
        data: { programId: canonicalId },
      });
      counters.assetChecksMoved += 1;
    }
  }

  counters.fileAssetUsagesDeleted += await tx.$executeRaw`
    DELETE FROM "recalc_admin"."file_asset_usage" duplicate_usage
    USING "recalc_admin"."file_asset_usage" canonical_usage
    WHERE duplicate_usage."target_type" = 'program'
      AND duplicate_usage."target_id" = ${duplicateId}
      AND duplicate_usage."is_primary" = true
      AND canonical_usage."target_type" = 'program'
      AND canonical_usage."target_id" = ${canonicalId}
      AND canonical_usage."slot" = duplicate_usage."slot"
      AND canonical_usage."is_primary" = true
  `;

  counters.fileAssetUsagesMoved += await tx.$executeRaw`
    UPDATE "recalc_admin"."file_asset_usage"
    SET "target_id" = ${canonicalId}, "updated_at" = now()
    WHERE "target_type" = 'program'
      AND "target_id" = ${duplicateId}
  `;

  await tx.program.delete({ where: { id: duplicateId } });
  counters.programsDeleted += 1;
}

export async function deleteDuplicateAcademicPrograms(options: {
  dryRun?: boolean;
  includeOrphanExtras?: boolean;
} = {}): Promise<AcademicProgramDedupeResult> {
  const candidates = await listProgramCandidates();
  const plan = buildAcademicProgramDedupePlan(candidates, {
    includeOrphanExtras: options.includeOrphanExtras ?? true,
  });
  const counters = emptyCounters();

  if (options.dryRun ?? true) {
    return { ...plan, applied: false, counters };
  }

  await prisma.$transaction(
    async (tx) => {
      const transactionalPrisma = tx as typeof prisma;

      for (const group of plan.groups) {
        for (const duplicateId of group.duplicateIds) {
          await mergeDuplicateProgramIntoCanonical(
            transactionalPrisma,
            duplicateId,
            group.canonicalId,
            counters,
          );
        }

        await transactionalPrisma.program.update({
          where: { id: group.canonicalId },
          data: {
            name: group.canonicalName,
            nameNormalized: group.canonicalKey,
          },
        });
      }

      for (const orphanId of plan.orphanExtraIds) {
        await transactionalPrisma.program.delete({ where: { id: orphanId } });
        counters.programsDeleted += 1;
      }
    },
    { timeout: 60_000 },
  );

  return { ...plan, applied: true, counters };
}

export async function normalizeExistingAcademicProgramNames(options: {
  dryRun?: boolean;
} = {}): Promise<AcademicProgramNameNormalizationResult> {
  const programs = await prisma.program.findMany({
    orderBy: [{ name: "asc" }],
    select: {
      id: true,
      name: true,
      nameNormalized: true,
      level: true,
      category: true,
      businessLine: true,
    },
  });
  const plan = buildAcademicProgramNameNormalizationPlan(programs);
  const counters = { programsUpdated: 0 };

  if (options.dryRun ?? true) {
    return { ...plan, applied: false, counters };
  }

  if (plan.conflicts.length > 0) {
    return { ...plan, applied: false, counters };
  }

  await prisma.$transaction(
    async (tx) => {
      for (const item of plan.renames) {
        await tx.program.update({
          where: { id: item.id },
          data: {
            name: item.nextName,
            nameNormalized: item.nextNameNormalized,
          },
        });
        counters.programsUpdated += 1;
      }
    },
    { timeout: 60_000 },
  );

  return { ...plan, applied: true, counters };
}
