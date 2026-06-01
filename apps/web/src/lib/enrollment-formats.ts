import { prisma } from "@/lib/prisma";
import {
  getFileAssetForUsage,
  listFileAssetAssignmentsForTargets,
  resolveEnrollmentFormatR2AssetPayload,
  toPublicFileAssetPayload,
  type PublicFileAssetPayload,
} from "@/lib/file-assets";

export type EnrollmentFormatSourceType = "upload" | "link" | "r2";

export type EnrollmentFormatInput = {
  id: string;
  title: string;
  description: string | null;
  fileName: string | null;
  fileUrl: string;
  fileMimeType: string | null;
  fileSizeBytes: number | null;
  sourceType: EnrollmentFormatSourceType;
  isActive: boolean;
  sortOrder: number;
};

export type EnrollmentFormatRecord = EnrollmentFormatInput & {
  fileDownloadUrl: string;
  r2Asset: PublicFileAssetPayload | null;
};

type EnrollmentFormatRow = Omit<EnrollmentFormatInput, "sourceType"> & {
  sourceType: string;
};

function normalizeEnrollmentFormatSourceType(
  value: string,
): EnrollmentFormatSourceType {
  if (value === "r2") return "r2";
  return value === "upload" ? "upload" : "link";
}

function pickFormatDocumentAsset(
  assets: Record<string, PublicFileAssetPayload> | undefined,
) {
  return assets?.format_document ?? assets?.format_pdf ?? assets?.format_file ?? null;
}

function mapEnrollmentFormat(
  format: EnrollmentFormatRow,
  asset: PublicFileAssetPayload | null | undefined,
): EnrollmentFormatRecord {
  const resolvedFile = resolveEnrollmentFormatR2AssetPayload({
    fileName: format.fileName,
    fileUrl: format.fileUrl,
    fileMimeType: format.fileMimeType,
    fileSizeBytes: format.fileSizeBytes,
    sourceType: normalizeEnrollmentFormatSourceType(format.sourceType),
    asset,
  });

  return {
    ...format,
    ...resolvedFile,
    sourceType: normalizeEnrollmentFormatSourceType(resolvedFile.sourceType),
  };
}

export async function listEnrollmentFormats(options?: {
  includeInactive?: boolean;
  query?: string;
}): Promise<EnrollmentFormatRecord[]> {
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

  const assignments = await listFileAssetAssignmentsForTargets(
    "enrollment_format",
    formats.map((format) => format.id),
  );

  return formats.map((format) =>
    mapEnrollmentFormat(format, pickFormatDocumentAsset(assignments.get(format.id))),
  );
}

export async function getEnrollmentFormat(
  id: string,
): Promise<EnrollmentFormatRecord | null> {
  const format = await prisma.enrollmentFormat.findUnique({
    where: { id },
  });

  if (!format) return null;
  const usage = await getFileAssetForUsage({
    targetType: "enrollment_format",
    targetId: id,
    slot: "format_document",
  });

  return mapEnrollmentFormat(format, usage ? toPublicFileAssetPayload(usage.file) : null);
}

export async function upsertEnrollmentFormat(format: EnrollmentFormatInput) {
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
