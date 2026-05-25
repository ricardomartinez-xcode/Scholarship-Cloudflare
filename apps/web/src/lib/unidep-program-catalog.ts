import type { BenefitBusinessLine, Prisma } from "@prisma/client";

import { normalizeBusinessLine } from "@/lib/pricing-normalize";
import { prisma } from "@/lib/prisma";
import { normalizeKey } from "@/lib/text-normalize";

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
  const programs = await prisma.program.findMany({
    orderBy: [{ name: "asc" }],
    select: UNIDEP_PROGRAM_CATALOG_SELECT,
    take: 400,
  });

  const query = String(filters.query ?? "").trim();
  const normalizedQuery = normalizeKey(query);

  return programs.filter((program) => {
    if (filters.onlyWithPlan && !getUnidepProgramPlanUrl(program)) return false;
    if (!matchesUnidepProgramLine(program, filters.businessLine)) return false;
    if (!normalizedQuery) return true;

    return normalizeKey([program.name, program.category].filter(Boolean).join(" ")).includes(
      normalizedQuery,
    );
  });
}
