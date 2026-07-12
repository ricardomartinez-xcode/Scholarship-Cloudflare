"use server";

import { randomUUID } from "node:crypto";

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
  getFileAssetById,
  toPublicFileAssetPayload,
  type FileAssetRecord,
} from "@/lib/file-assets";
import {
  PUBLIC_ROUTE_CACHE_TAGS,
  revalidatePublicRouteTags,
} from "@/lib/public-route-cache";

const FORMATS_WRITE_CAPABILITY = AdminCapability.manage_offers;
const FORMAT_ASSET_TARGET_TYPE = "enrollment_format";
const FORMAT_ASSET_SLOT = "format_document";

type FormatFilePayload = {
  fileName: string | null;
  fileUrl: string;
  fileMimeType: string | null;
  fileSizeBytes: number | null;
  sourceType: "upload" | "link" | "r2";
};

function validateUrl(raw: string | null) {
  const value = String(raw ?? "").trim();
  if (!value) return null;
  if (!value.startsWith("http://") && !value.startsWith("https://")) return null;
  return value;
}

function formatPayloadFromAsset(file: FileAssetRecord): FormatFilePayload {
  const payload = toPublicFileAssetPayload(file);
  if (!payload) {
    throw new Error("No fue posible preparar el archivo Storage.");
  }

  return {
    fileName: payload.fileName,
    fileUrl: payload.previewUrl,
    fileMimeType: payload.mimeType,
    fileSizeBytes: payload.sizeBytes,
    sourceType: "r2",
  };
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
    await requireAdminCapabilityUser(FORMATS_WRITE_CAPABILITY);

    const id = String(formData.get("id") ?? "").trim() || randomUUID();
    const current = formData.get("id") ? await getEnrollmentFormat(id) : null;
    const title = String(formData.get("title") ?? "").trim();
    const description = String(formData.get("description") ?? "").trim() || null;
    const sortOrder = Number.parseInt(String(formData.get("sortOrder") ?? "0"), 10);
    const isActive = formData.get("isActive") === "on";
    const linkUrlRaw = String(formData.get("fileUrl") ?? "").trim() || null;
    const fileAssetId = String(formData.get("fileAssetId") ?? "").trim();

    if (!title) throw new Error("El título es requerido.");

    const selectedAsset = fileAssetId ? await getFileAssetById(fileAssetId) : null;
    if (fileAssetId && !selectedAsset) {
      throw new Error("El archivo Storage seleccionado no existe o no está disponible.");
    }

    const r2Asset = selectedAsset;
    const linkUrl = validateUrl(linkUrlRaw);

    if (!r2Asset && linkUrlRaw && !linkUrl) {
      throw new Error("El link debe ser una URL http/https válida.");
    }

    if (!current && !r2Asset && !linkUrl) {
      throw new Error("Selecciona un asset Storage o captura un link de descarga.");
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
      throw new Error("Selecciona un asset Storage o captura un link de descarga.");
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
