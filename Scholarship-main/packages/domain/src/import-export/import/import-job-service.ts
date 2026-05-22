import { prisma } from "@/lib/prisma";
import type { ImportSummary } from "@relead/domain/import-export/import/types";

export async function saveImportJobHistory(params: {
  module: string;
  fileName: string;
  summary: ImportSummary;
  actorUserId: string;
  actorEmail: string;
}) {
  return prisma.adminImportSession.create({
    data: {
      module: params.module as never,
      fileName: params.fileName,
      source: "IMPORT",
      status: "preview",
      payload: params.summary as never,
      summary: params.summary as never,
      createdByUserId: params.actorUserId,
      createdByEmail: params.actorEmail,
    },
    select: { id: true, createdAt: true },
  });
}
