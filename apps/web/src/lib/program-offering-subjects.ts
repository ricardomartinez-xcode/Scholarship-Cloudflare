import { prisma } from "@/lib/prisma";

export async function listProgramOfferingSubjectsById(ids: string[]) {
  const uniqueIds = Array.from(new Set(ids.filter(Boolean)));
  if (!uniqueIds.length) return new Map<string, string | null>();

  try {
    const rows = await prisma.programOffering.findMany({
      where: {
        id: { in: uniqueIds },
      },
      select: {
        id: true,
        subjectsByModule: true,
      },
    });

    return new Map(rows.map((row) => [row.id, row.subjectsByModule] as const));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes("subjects_by_module") || message.includes("subjectsByModule")) {
      return new Map<string, string | null>();
    }
    throw error;
  }
}
