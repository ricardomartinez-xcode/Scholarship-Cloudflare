"use server";

import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
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
  PUBLIC_ROUTE_CACHE_TAGS,
  revalidatePublicRouteTags,
} from "@/lib/public-route-cache";

const FORMATS_WRITE_CAPABILITY = AdminCapability.manage_offers;
const MAX_FILE_SIZE_BYTES = 15 * 1024 * 1024;
type FormatFilePayload = {
  fileName: string | null;
  fileUrl: string;
  fileMimeType: string | null;
  fileSizeBytes: number | null;
  sourceType: "upload" | "link";
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

function getPublicUploadsDirectory() {
  const cwd = process.cwd();
  return cwd.endsWith(path.join("apps", "web"))
    ? path.join(cwd, "public", "uploads", "formatos")
    : path.join(cwd, "apps", "web", "public", "uploads", "formatos");
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

async function persistUpload(file: File): Promise<FormatFilePayload | null> {
  if (file.size <= 0) return null;
  if (file.size > MAX_FILE_SIZE_BYTES) {
    throw new Error("El archivo no puede pesar más de 15 MB.");
  }

  const info = getAllowedFileInfo(file);
  if (!info) {
    throw new Error("Solo se permiten archivos PDF, DOC o DOCX.");
  }

  const uploadDir = getPublicUploadsDirectory();
  await mkdir(uploadDir, { recursive: true });

  const safeName = `${Date.now()}-${randomUUID()}${info.extension}`;
  const absolutePath = path.join(uploadDir, safeName);
  const bytes = Buffer.from(await file.arrayBuffer());
  await writeFile(absolutePath, bytes);

  return {
    fileName: info.originalName,
    fileUrl: `/uploads/formatos/${safeName}`,
    fileMimeType: info.mimeType,
    fileSizeBytes: file.size,
    sourceType: "upload",
  };
}

function revalidateFormats() {
  revalidatePath("/admin/unidep/formatos");
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
    const file = formData.get("file");

    if (!title) throw new Error("El título es requerido.");

    const upload =
      file instanceof File && file.size > 0 ? await persistUpload(file) : null;
    const linkUrl = validateUrl(linkUrlRaw);

    if (!upload && linkUrlRaw && !linkUrl) {
      throw new Error("El link debe ser una URL http/https válida.");
    }

    if (!current && !upload && !linkUrl) {
      throw new Error("Sube un archivo o captura un link de descarga.");
    }

    const nextFile: FormatFilePayload | null = upload
      ? {
          fileName: upload.fileName,
          fileUrl: upload.fileUrl,
          fileMimeType: upload.fileMimeType,
          fileSizeBytes: upload.fileSizeBytes,
          sourceType: "upload" as const,
        }
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
      throw new Error("Sube un archivo o captura un link de descarga.");
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
    await deleteEnrollmentFormat(id);
    revalidateFormats();
  } catch {
    throw new Error("No fue posible eliminar el formato.");
  }
}
