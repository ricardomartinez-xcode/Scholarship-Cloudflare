import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

export async function listProgramOfferingSubjectsById(ids: string[]) {
  const uniqueIds = Array.from(new Set(ids.filter(Boolean)));
  if (!uniqueIds.length) return new Map<string, string | null>();
  const client = prisma as typeof prisma & { $queryRaw?: typeof prisma.$queryRaw };

  if (typeof client.$queryRaw !== "function") {
    return new Map<string, string | null>();
  }

  try {
    const rows = await client.$queryRaw<
      Array<{ id: string; subjects_by_module: string | null }>
    >`
      SELECT id, subjects_by_module
      FROM recalc_admin.program_offering
      WHERE id IN (${Prisma.join(uniqueIds)})
    `;

    return new Map(rows.map((row) => [row.id, row.subjects_by_module] as const));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes("subjects_by_module")) {
      return new Map<string, string | null>();
    }
    throw error;
  }
}
