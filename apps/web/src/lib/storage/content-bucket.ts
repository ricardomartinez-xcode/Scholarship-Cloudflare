import "server-only";

import {
  createSignedStorageDownloadUrl,
  listStorageObjects,
  STORAGE_BUCKETS,
  type ListedStorageObject,
} from "@/lib/storage/supabase-storage";

export type ContentBucketObject = {
  key: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number | null;
  lastModified: string | null;
  previewUrl: string;
  downloadUrl: string;
};

const PROGRAM_MATCH_STOPWORDS = new Set([
  "bachillerato",
  "estudio",
  "estudios",
  "licenciatura",
  "maestria",
  "maestría",
  "plan",
  "planes",
  "posgrado",
  "programa",
  "unidep",
]);

function trimSlashes(value: string) {
  return value.replace(/^\/+|\/+$/g, "");
}

function encodePathSegment(value: string) {
  return encodeURIComponent(value).replace(/[!'()*]/g, (char) =>
    `%${char.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}

function encodePath(value: string) {
  return value.split("/").map(encodePathSegment).join("/");
}

export function buildContentBucketProxyUrl(key: string, options?: { download?: boolean }) {
  const normalizedKey = trimSlashes(key);
  return `/api/content-bucket/${encodePath(normalizedKey)}${options?.download ? "?download=1" : ""}`;
}

export function buildContentBucketPublicUrl(key: string) {
  return buildContentBucketProxyUrl(key);
}

export function buildContentBucketDownloadUrl(key: string) {
  return buildContentBucketProxyUrl(key, { download: true });
}

export function getContentBucketName() {
  return STORAGE_BUCKETS.documents;
}

export async function getSignedContentBucketGetUrl(options: {
  key: string;
  fileName?: string | null;
  contentType?: string | null;
  disposition: "inline" | "attachment";
  expiresSeconds?: number;
}) {
  const key = trimSlashes(options.key);
  const fileName = options.fileName ?? decodeURIComponent(key.split("/").pop() || "archivo");
  return createSignedStorageDownloadUrl({
    bucket: getContentBucketName(),
    key,
    fileName,
    disposition: options.disposition,
    expiresSeconds: options.expiresSeconds,
  });
}

function normalizePlanMatchText(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\.[a-z0-9]+$/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function getMatchTokens(value: string) {
  return normalizePlanMatchText(value)
    .split(/\s+/g)
    .filter((token) => token.length > 2 && !PROGRAM_MATCH_STOPWORDS.has(token));
}

export function findContentBucketPlanForProgram(
  programName: string,
  bucketFiles: ContentBucketObject[],
) {
  const tokens = getMatchTokens(programName);
  if (!tokens.length) return null;

  return (
    bucketFiles.find((file) => {
      if (file.mimeType !== "application/pdf") return false;
      const fileText = normalizePlanMatchText(`${file.key} ${file.fileName}`);
      const matches = tokens.filter((token) => fileText.includes(token)).length;
      const requiredMatches =
        tokens.length <= 2 ? tokens.length : Math.ceil(tokens.length * 0.75);
      return matches >= Math.max(1, requiredMatches);
    }) ?? null
  );
}

function toContentBucketObject(file: ListedStorageObject): ContentBucketObject {
  return {
    key: file.key,
    fileName: file.fileName,
    mimeType: file.mimeType,
    sizeBytes: file.sizeBytes,
    lastModified: file.lastModified,
    previewUrl: buildContentBucketPublicUrl(file.key),
    downloadUrl: buildContentBucketDownloadUrl(file.key),
  };
}

export async function listContentBucketObjects() {
  try {
    const objects = await listStorageObjects({
      bucket: getContentBucketName(),
      maxDepth: 6,
    });
    return objects
      .filter((item) => item.key && !item.key.endsWith("/"))
      .map(toContentBucketObject)
      .sort((left, right) => left.fileName.localeCompare(right.fileName, "es"));
  } catch {
    return [];
  }
}
