import { prisma } from "@/lib/prisma";
import { listD1ProgramOfferingModuleMetaById } from "@/lib/cloudflare/public-data";
import { isCloudflareRuntime } from "@/lib/cloudflare/runtime";

export type ProgramOfferingModuleMeta = {
  subjectsByModule: string | null;
  moduleCount: number | null;
};

function emptyModuleMetaMap(ids: string[]) {
  return new Map(
    ids.map((id) => [
      id,
      { subjectsByModule: null, moduleCount: null } satisfies ProgramOfferingModuleMeta,
    ]),
  );
}

export async function listProgramOfferingModuleMetaById(ids: string[]) {
  const uniqueIds = Array.from(new Set(ids.filter(Boolean)));
  if (!uniqueIds.length) return new Map<string, ProgramOfferingModuleMeta>();
  if (isCloudflareRuntime()) return listD1ProgramOfferingModuleMetaById(uniqueIds);

  try {
    const rows = await prisma.programOffering.findMany({
      where: {
        id: { in: uniqueIds },
      },
      select: {
        id: true,
        subjectsByModule: true,
        moduleCount: true,
      },
    });
    if (!Array.isArray(rows)) return emptyModuleMetaMap(uniqueIds);

    return new Map(
      rows.map((row) => [
        row.id,
        {
          subjectsByModule: row.subjectsByModule,
          moduleCount: row.moduleCount,
        } satisfies ProgramOfferingModuleMeta,
      ]),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (
      message.includes("subjects_by_module") ||
      message.includes("subjectsByModule") ||
      message.includes("module_count") ||
      message.includes("moduleCount")
    ) {
      return emptyModuleMetaMap(uniqueIds);
    }
    throw error;
  }
}

export async function listProgramOfferingSubjectsById(ids: string[]) {
  const moduleMetaById = await listProgramOfferingModuleMetaById(ids);
  return new Map(
    Array.from(moduleMetaById.entries()).map(([id, meta]) => [
      id,
      meta.subjectsByModule,
    ] as const),
  );
}
