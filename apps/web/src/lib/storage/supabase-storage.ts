import "server-only";

import { randomUUID } from "node:crypto";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const SIGNED_URL_EXPIRES_SECONDS = 10 * 60;
const DEFAULT_MAX_UPLOAD_BYTES = 20 * 1024 * 1024;

export const STORAGE_BUCKETS = {
  documents: "documents",
  avatars: "avatars",
  imports: "imports",
  exports: "exports",
  attachments: "attachments",
} as const;

export type StorageBucketName = (typeof STORAGE_BUCKETS)[keyof typeof STORAGE_BUCKETS];

export const PREVIEWABLE_MIME_TYPES = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
  "video/mp4",
  "video/webm",
]);

export const ALLOWED_FILE_MIME_TYPES = new Set([
  ...PREVIEWABLE_MIME_TYPES,
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
]);

export type ListedStorageObject = {
  key: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number | null;
  lastModified: string | null;
};

type UploadBody = ArrayBuffer | Blob | File | ReadableStream<Uint8Array>;

function sanitizePathSegment(value: string | null | undefined, fallback: string) {
  const sanitized = String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 96);

  return sanitized || fallback;
}

function extensionFromFileName(fileName: string) {
  const extension = fileName.includes(".") ? fileName.split(".").pop()?.toLowerCase() : null;
  const suffix = extension ? extension.replace(/[^a-z0-9]/g, "") : "";
  return suffix ? `.${suffix}` : "";
}

export function createStorageObjectKey(
  fileName: string,
  options?: {
    organizationId?: string | null;
    userId?: string | null;
    resourceId?: string | null;
    prefix?: string;
  },
) {
  const organizationId = sanitizePathSegment(options?.organizationId, "shared");
  const userId = sanitizePathSegment(options?.userId, "system");
  const resourceId = sanitizePathSegment(options?.resourceId, "uploads");
  const prefix = sanitizePathSegment(options?.prefix, "documents");
  const date = new Date().toISOString().slice(0, 10);

  return `organizations/${organizationId}/users/${userId}/${prefix}/${resourceId}/${date}/${randomUUID()}${extensionFromFileName(fileName)}`;
}

export function getStorageBucketName(bucket: StorageBucketName = STORAGE_BUCKETS.documents) {
  return bucket;
}

export function getMaxUploadBytes() {
  const configured = Number(process.env.MAX_UPLOAD_BYTES);
  return Number.isFinite(configured) && configured > 0 ? configured : DEFAULT_MAX_UPLOAD_BYTES;
}

export function isAllowedFileMimeType(mimeType: string) {
  return ALLOWED_FILE_MIME_TYPES.has(mimeType);
}

export function isPreviewableMimeType(mimeType: string) {
  return PREVIEWABLE_MIME_TYPES.has(mimeType);
}

export function normalizeImageContentType(value: string | null | undefined) {
  const raw = String(value ?? "").split(";")[0].trim().toLowerCase();
  if (raw === "image/jpg" || raw === "image/pjpeg" || raw === "image/jfif") return "image/jpeg";
  if (raw === "image/jpeg" || raw === "image/png" || raw === "image/webp") return raw;
  return "";
}

export function extensionFromImageContentType(contentType: string) {
  if (contentType === "image/png") return "png";
  if (contentType === "image/webp") return "webp";
  return "jpg";
}

export function isSupportedImageContentType(contentType: string) {
  return contentType === "image/jpeg" || contentType === "image/png" || contentType === "image/webp";
}

export async function uploadStorageObject(input: {
  bucket?: StorageBucketName | string | null;
  key: string;
  body: UploadBody;
  contentType: string;
  upsert?: boolean;
}) {
  const bucket = input.bucket || STORAGE_BUCKETS.documents;
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.storage.from(bucket).upload(input.key, input.body, {
    contentType: input.contentType,
    upsert: input.upsert ?? false,
    cacheControl: "3600",
  });

  if (error) {
    throw new Error(`Supabase Storage upload failed: ${error.message}`);
  }

  return data;
}

export async function downloadStorageObject(input: {
  bucket?: StorageBucketName | string | null;
  key: string;
}) {
  const bucket = input.bucket || STORAGE_BUCKETS.documents;
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.storage.from(bucket).download(input.key);

  if (error) {
    throw new Error(`Supabase Storage download failed: ${error.message}`);
  }

  return data;
}

export async function createSignedStorageDownloadUrl(input: {
  bucket?: StorageBucketName | string | null;
  key: string;
  fileName: string;
  disposition: "inline" | "attachment";
  expiresSeconds?: number;
}) {
  const bucket = input.bucket || STORAGE_BUCKETS.documents;
  const supabase = createSupabaseAdminClient();
  const options = input.disposition === "attachment" ? { download: input.fileName } : undefined;
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(input.key, input.expiresSeconds ?? SIGNED_URL_EXPIRES_SECONDS, options);

  if (error || !data?.signedUrl) {
    throw new Error(`Supabase Storage signed URL failed: ${error?.message ?? "missing signedUrl"}`);
  }

  return data.signedUrl;
}

function inferMimeType(key: string) {
  const ext = key.split(".").pop()?.toLowerCase();
  if (ext === "pdf") return "application/pdf";
  if (ext === "png") return "image/png";
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  if (ext === "webp") return "image/webp";
  if (ext === "mp4") return "video/mp4";
  if (ext === "webm") return "video/webm";
  if (ext === "docx") return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  if (ext === "xlsx") return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  if (ext === "pptx") return "application/vnd.openxmlformats-officedocument.presentationml.presentation";
  return "application/octet-stream";
}

function getMetadataNumber(metadata: Record<string, unknown> | null | undefined, key: string) {
  const value = metadata?.[key];
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function getMetadataString(metadata: Record<string, unknown> | null | undefined, key: string) {
  const value = metadata?.[key];
  return typeof value === "string" ? value : null;
}

type SupabaseStorageListItem = {
  id?: string | null;
  name?: string;
  updated_at?: string | null;
  created_at?: string | null;
  metadata?: Record<string, unknown> | null;
};

export async function listStorageObjects(input?: {
  bucket?: StorageBucketName | string | null;
  prefix?: string;
  maxDepth?: number;
}) {
  const bucket = input?.bucket || STORAGE_BUCKETS.documents;
  const maxDepth = Math.min(Math.max(input?.maxDepth ?? 4, 0), 8);
  const supabase = createSupabaseAdminClient();
  const objects: ListedStorageObject[] = [];

  async function walk(prefix: string, depth: number) {
    const { data, error } = await supabase.storage.from(bucket).list(prefix, {
      limit: 1000,
      offset: 0,
      sortBy: { column: "name", order: "asc" },
    });

    if (error) {
      throw new Error(`Supabase Storage list failed: ${error.message}`);
    }

    for (const item of (data ?? []) as SupabaseStorageListItem[]) {
      if (!item.name) continue;
      const key = prefix ? `${prefix.replace(/\/+$/g, "")}/${item.name}` : item.name;
      const isFolder = !item.id && !getMetadataString(item.metadata, "mimetype");
      if (isFolder && depth < maxDepth) {
        await walk(key, depth + 1);
        continue;
      }

      objects.push({
        key,
        fileName: item.name,
        mimeType: getMetadataString(item.metadata, "mimetype") ?? inferMimeType(key),
        sizeBytes: getMetadataNumber(item.metadata, "size"),
        lastModified: item.updated_at ?? item.created_at ?? null,
      });
    }
  }

  await walk((input?.prefix ?? "").replace(/^\/+|\/+$/g, ""), 0);
  return objects.sort((left, right) => left.fileName.localeCompare(right.fileName, "es"));
}
