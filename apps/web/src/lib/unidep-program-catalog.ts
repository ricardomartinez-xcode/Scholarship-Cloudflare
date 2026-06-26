import type { BenefitBusinessLine, Prisma } from "@prisma/client";
import {
  normalizeAcademicProgramKey,
  normalizeAcademicProgramName,
} from "@relead/db/program-name-normalization";

import { normalizeBusinessLine } from "@/lib/pricing-normalize";
import { prisma } from "@/lib/prisma";
import { normalizeKey } from "@/lib/text-normalize";
import { isCloudflareRuntime } from "@/lib/cloudflare/runtime";
import { listD1ProgramCatalog } from "@/lib/cloudflare/public-data";

export const UNIDEP_PROGRAM_CATALOG_SELECT = {
  id: true,
  name: true,
  nameNormalized: true,
  category: true,
  level: true,
  businessLine: true,
  planPdfUrl: true,
  brochurePdfUrl: true,
  planDriveLink: true,
  planUrl: true,
  _count: {
    select: {
      offerings: true,
    },
  },
} satisfies Prisma.ProgramSelect;

export type UnidepProgramCatalogItem = Prisma.ProgramGetPayload<{
  select: typeof UNIDEP_PROGRAM_CATALOG_SELECT;
}>;

export type UnidepProgramCatalogFilters = {
  businessLine?: string | null;
  query?: string | null;
  onlyWithPlan?: boolean;
};

export function getUnidepProgramPlanUrl(program: {
  planPdfUrl: string | null;
  planDriveLink: string | null;
  planUrl: string | null;
}) {
  return program.planPdfUrl ?? program.planDriveLink ?? program.planUrl ?? null;
}

type DedupeableProgram = UnidepProgramCatalogItem | (UnidepProgramCatalogItem & {
  _count?: { offerings?: number | null };
});

function programCompletenessScore(program: DedupeableProgram) {
  const offerings = Number(program._count?.offerings ?? 0);
  return (
    offerings * 100 +
    (program.businessLine ? 10 : 0) +
    (program.level ? 4 : 0) +
    (getUnidepProgramPlanUrl(program) ? 2 : 0) +
    (program.brochurePdfUrl ? 1 : 0)
  );
}

export function dedupeUnidepProgramCatalog<T extends DedupeableProgram>(
  programs: ReadonlyArray<T>,
): T[] {
  const byCanonicalKey = new Map<string, T>();

  for (const program of programs) {
    const normalized = normalizeAcademicProgramName(program.name || program.nameNormalized);
    const key = normalized.nameNormalized || normalizeAcademicProgramKey(program.nameNormalized);
    if (!key) continue;

    const normalizedProgram = {
      ...program,
      nameNormalized: normalized.nameNormalized,
    };
    const current = byCanonicalKey.get(key);
    if (!current || programCompletenessScore(normalizedProgram) > programCompletenessScore(current)) {
      byCanonicalKey.set(key, normalizedProgram);
    }
  }

  return Array.from(byCanonicalKey.values()).sort((left, right) =>
    left.name.localeCompare(right.name, "es"),
  );
}

export function normalizeUnidepProgramBusinessLine(
  raw: string | null | undefined,
): BenefitBusinessLine | null {
  return normalizeBusinessLine(raw) as BenefitBusinessLine | null;
}

export function matchesUnidepProgramLine(
  program: Pick<UnidepProgramCatalogItem, "businessLine" | "level" | "category">,
  lineRaw: string | null | undefined,
) {
  const raw = String(lineRaw ?? "").trim();
  if (!raw) return true;

  const normalizedLine = normalizeUnidepProgramBusinessLine(raw);
  if (normalizedLine && program.businessLine === normalizedLine) return true;

  const normalizedRaw = normalizeKey(raw);
  return (
    normalizeKey(program.level ?? "") === normalizedRaw ||
    normalizeKey(program.category ?? "").includes(normalizedRaw)
  );
}

export async function getUnidepProgramCatalog(filters: UnidepProgramCatalogFilters = {}) {
  const programs = isCloudflareRuntime()
    ? await listD1ProgramCatalog()
    : await prisma.program.findMany({
        orderBy: [{ name: "asc" }],
        select: UNIDEP_PROGRAM_CATALOG_SELECT,
        take: 400,
      });

  const query = String(filters.query ?? "").trim();
  const normalizedQuery = normalizeKey(query);

  const filteredPrograms = programs.filter((program) => {
    if (filters.onlyWithPlan && !getUnidepProgramPlanUrl(program)) return false;
    if (!matchesUnidepProgramLine(program, filters.businessLine)) return false;
    if (!normalizedQuery) return true;

    return normalizeKey([program.name, program.category].filter(Boolean).join(" ")).includes(
      normalizedQuery,
    );
  });

  return dedupeUnidepProgramCatalog(filteredPrograms);
}
