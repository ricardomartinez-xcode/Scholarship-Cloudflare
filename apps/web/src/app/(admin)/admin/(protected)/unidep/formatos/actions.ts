"use server";

import { randomUUID } from "node:crypto";
import path from "node:path";

import { revalidatePath } from "next/cache";
import { AdminCapability } from "@prisma/client";

import { requireAdminCapabilityUser } from "@/lib/admin-session";
import {
  deleteEnrollmentFormat,
  getEnrollmentFormat,
  upsertEnrollmentFormat,
} from "@/lib/enrollment-formats";
import {
  assignFileAssetUsage,
  clearFileAssetUsage,
  createFileAsset,
  getFileAssetById,
  markFileAssetUploaded,
  toPublicFileAssetPayload,
  type FileAssetRecord,
} from "@/lib/file-assets";
import {
  PUBLIC_ROUTE_CACHE_TAGS,
  revalidatePublicRouteTags,
} from "@/lib/public-route-cache";
import {
  createR2ObjectKey,
  getR2BucketName,
  getSignedR2PutUrl,
} from "@/lib/r2-storage";

const FORMATS_WRITE_CAPABILITY = AdminCapability.manage_offers;
const MAX_FILE_SIZE_BYTES = 15 * 1024 * 1024;
const FORMAT_ASSET_TARGET_TYPE = "enrollment_format";
const FORMAT_ASSET_SLOT = "format_document";

type FormatFilePayload = {
  fileName: string | null;
  fileUrl: string;
  fileMimeType: string | null;
  fileSizeBytes: number | null;
  sourceType: "upload" | "link" | "r2";
};

const ALLOWED_FORMATS = [
  {
    extensions: [".pdf"],
    mimeTypes: ["application/pdf"],
  },
  {
    extensions: [".doc"],
    mimeTypes: ["application/msword"],
  },
  {
    extensions: [".docx"],
    mimeTypes: [
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ],
  },
] satisfies Array<{ extensions: string[]; mimeTypes: string[] }>;

function validateUrl(raw: string | null) {
  const value = String(raw ?? "").trim();
  if (!value) return null;
  if (!value.startsWith("http://") && !value.startsWith("https://")) return null;
  return value;
}

function getAllowedFileInfo(file: File) {
  const originalName = file.name || "formato";
  const extension = path.extname(originalName).toLowerCase();
  const allowed = ALLOWED_FORMATS.some(
    (item) =>
      item.extensions.includes(extension) &&
      (!file.type || item.mimeTypes.includes(file.type)),
  );

  if (!allowed) return null;
  return { originalName, extension, mimeType: file.type || "application/octet-stream" };
}

function formatPayloadFromAsset(file: FileAssetRecord): FormatFilePayload {
  const payload = toPublicFileAssetPayload(file);
  if (!payload) {
    throw new Error("No fue posible preparar el archivo R2.");
  }

  return {
    fileName: payload.fileName,
    fileUrl: payload.previewUrl,
    fileMimeType: payload.mimeType,
    fileSizeBytes: payload.sizeBytes,
    sourceType: "r2",
  };
}

async function persistUpload(file: File, uploadedByUserId: string): Promise<FileAssetRecord | null> {
  if (file.size <= 0) return null;
  if (file.size > MAX_FILE_SIZE_BYTES) {
    throw new Error("El archivo no puede pesar más de 15 MB.");
  }

  const info = getAllowedFileInfo(file);
  if (!info) {
    throw new Error("Solo se permiten archivos PDF, DOC o DOCX.");
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const key = createR2ObjectKey(info.originalName);
  const asset = await createFileAsset({
    r2Key: key,
    bucket: getR2BucketName(),
    fileName: info.originalName,
    mimeType: info.mimeType,
    sizeBytes: file.size,
    uploadedByUserId,
    status: "pending",
  });
  const uploadResponse = await fetch(
    getSignedR2PutUrl({
      key,
      contentType: info.mimeType,
    }),
    {
      method: "PUT",
      headers: { "Content-Type": info.mimeType },
      body: bytes,
    },
  );

  if (!uploadResponse.ok) {
    throw new Error(`R2 rechazó la carga del formato (${uploadResponse.status}).`);
  }

  const uploaded = await markFileAssetUploaded(asset.id, uploadResponse.headers.get("etag"));
  if (!uploaded) {
    throw new Error("El formato subió a R2, pero no se pudo confirmar.");
  }

  return uploaded;
}

function revalidateFormats() {
  revalidatePath("/admin/unidep/formatos");
  revalidatePath("/admin/files");
  revalidatePath("/api/public/formatos");
  revalidatePath("/unidep/formatos");
  revalidatePublicRouteTags([PUBLIC_ROUTE_CACHE_TAGS.formatos]);
}

export async function upsertEnrollmentFormatAction(formData: FormData) {
  try {
    const admin = await requireAdminCapabilityUser(FORMATS_WRITE_CAPABILITY);

    const id = String(formData.get("id") ?? "").trim() || randomUUID();
    const current = formData.get("id") ? await getEnrollmentFormat(id) : null;
    const title = String(formData.get("title") ?? "").trim();
    const description = String(formData.get("description") ?? "").trim() || null;
    const sortOrder = Number.parseInt(String(formData.get("sortOrder") ?? "0"), 10);
    const isActive = formData.get("isActive") === "on";
    const linkUrlRaw = String(formData.get("fileUrl") ?? "").trim() || null;
    const fileAssetId = String(formData.get("fileAssetId") ?? "").trim();
    const file = formData.get("file");

    if (!title) throw new Error("El título es requerido.");

    const uploadedAsset =
      file instanceof File && file.size > 0 ? await persistUpload(file, admin.id) : null;
    const selectedAsset = !uploadedAsset && fileAssetId ? await getFileAssetById(fileAssetId) : null;
    if (fileAssetId && !selectedAsset) {
      throw new Error("El archivo R2 seleccionado no existe o no está disponible.");
    }

    const r2Asset = uploadedAsset ?? selectedAsset;
    const linkUrl = validateUrl(linkUrlRaw);

    if (!r2Asset && linkUrlRaw && !linkUrl) {
      throw new Error("El link debe ser una URL http/https válida.");
    }

    if (!current && !r2Asset && !linkUrl) {
      throw new Error("Sube un archivo, selecciona un asset R2 o captura un link de descarga.");
    }

    const nextFile: FormatFilePayload | null = r2Asset
      ? formatPayloadFromAsset(r2Asset)
      : linkUrl
        ? {
            fileName: null,
            fileUrl: linkUrl,
            fileMimeType: null,
            fileSizeBytes: null,
            sourceType: "link" as const,
          }
        : current
          ? {
              fileName: current.fileName,
              fileUrl: current.fileUrl,
              fileMimeType: current.fileMimeType,
              fileSizeBytes: current.fileSizeBytes,
              sourceType: current.sourceType,
            }
          : null;

    if (!nextFile) {
      throw new Error("Sube un archivo, selecciona un asset R2 o captura un link de descarga.");
    }

    await upsertEnrollmentFormat({
      id,
      title,
      description,
      isActive,
      sortOrder: Number.isFinite(sortOrder) ? sortOrder : 0,
      fileName: nextFile.fileName,
      fileUrl: nextFile.fileUrl,
      fileMimeType: nextFile.fileMimeType,
      fileSizeBytes: nextFile.fileSizeBytes,
      sourceType: nextFile.sourceType,
    });

    if (r2Asset) {
      await assignFileAssetUsage(r2Asset.id, {
        targetType: FORMAT_ASSET_TARGET_TYPE,
        targetId: id,
        slot: FORMAT_ASSET_SLOT,
        isPrimary: true,
      });
    } else if (linkUrl) {
      await clearFileAssetUsage({
        targetType: FORMAT_ASSET_TARGET_TYPE,
        targetId: id,
        slot: FORMAT_ASSET_SLOT,
      });
    }

    revalidateFormats();
  } catch (error) {
    throw new Error(
      error instanceof Error ? error.message : "No fue posible guardar el formato.",
    );
  }
}

export async function deleteEnrollmentFormatAction(formData: FormData) {
  try {
    await requireAdminCapabilityUser(FORMATS_WRITE_CAPABILITY);
    const id = String(formData.get("id") ?? "").trim();
    if (!id) throw new Error("ID requerido.");
    await clearFileAssetUsage({
      targetType: FORMAT_ASSET_TARGET_TYPE,
      targetId: id,
      slot: FORMAT_ASSET_SLOT,
    });
    await deleteEnrollmentFormat(id);
    revalidateFormats();
  } catch {
    throw new Error("No fue posible eliminar el formato.");
  }
}
