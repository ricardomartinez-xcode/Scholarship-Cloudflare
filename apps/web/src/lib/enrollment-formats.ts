import { prisma } from "@/lib/prisma";

export type EnrollmentFormatRecord = {
  id: string;
  title: string;
  description: string | null;
  fileName: string | null;
  fileUrl: string;
  fileMimeType: string | null;
  fileSizeBytes: number | null;
  sourceType: "upload" | "link";
  isActive: boolean;
  sortOrder: number;
};

export async function listEnrollmentFormats(options?: {
  includeInactive?: boolean;
  query?: string;
}) {
  const query = options?.query?.trim() ?? "";
  const formats = await prisma.enrollmentFormat.findMany({
    where: {
      ...(options?.includeInactive ? {} : { isActive: true }),
      ...(query
        ? {
            OR: [
              { title: { contains: query, mode: "insensitive" } },
              { description: { contains: query, mode: "insensitive" } },
              { fileName: { contains: query, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    orderBy: [{ sortOrder: "asc" }, { title: "asc" }],
  });

  return formats.map((format) => ({
    ...format,
    sourceType: format.sourceType === "upload" ? "upload" : "link",
  }));
}

export async function getEnrollmentFormat(id: string) {
  const format = await prisma.enrollmentFormat.findUnique({
    where: { id },
  });

  if (!format) return null;
  return {
    ...format,
    sourceType: format.sourceType === "upload" ? "upload" : "link",
  };
}

export async function upsertEnrollmentFormat(format: EnrollmentFormatRecord) {
  await prisma.enrollmentFormat.upsert({
    where: { id: format.id },
    create: {
      id: format.id,
      title: format.title,
      description: format.description,
      fileName: format.fileName,
      fileUrl: format.fileUrl,
      fileMimeType: format.fileMimeType,
      fileSizeBytes: format.fileSizeBytes,
      sourceType: format.sourceType,
      isActive: format.isActive,
      sortOrder: format.sortOrder,
    },
    update: {
      title: format.title,
      description: format.description,
      fileName: format.fileName,
      fileUrl: format.fileUrl,
      fileMimeType: format.fileMimeType,
      fileSizeBytes: format.fileSizeBytes,
      sourceType: format.sourceType,
      isActive: format.isActive,
      sortOrder: format.sortOrder,
    },
  });
}

export async function deleteEnrollmentFormat(id: string) {
  await prisma.enrollmentFormat.delete({
    where: { id },
  });
}
