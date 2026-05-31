import { createHash, createHmac, randomUUID } from "node:crypto";

const SIGNED_URL_EXPIRES_SECONDS = 10 * 60;
const DEFAULT_MAX_UPLOAD_BYTES = 20 * 1024 * 1024;

export const PREVIEWABLE_MIME_TYPES = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
]);

export const ALLOWED_FILE_MIME_TYPES = new Set([
  ...PREVIEWABLE_MIME_TYPES,
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
]);

type R2Config = {
  endpoint: string;
  hostname: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  region: string;
};

type SignedGetOptions = {
  key: string;
  fileName: string;
  contentType?: string | null;
  disposition: "inline" | "attachment";
  expiresSeconds?: number;
};

type SignedPutOptions = {
  key: string;
  contentType?: string;
  expiresSeconds?: number;
};

type CompatSignedUrlOptions = {
  method: "GET" | "PUT";
  key: string;
  expiresSeconds?: number;
  responseContentDisposition?: string;
  fileName?: string;
  contentType?: string | null;
};

function getR2Config(): R2Config {
  const bucket = process.env.R2_BUCKET ?? process.env.CLOUDFLARE_R2_BUCKET;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID ?? process.env.CLOUDFLARE_R2_ACCESS_KEY_ID;
  const secretAccessKey =
    process.env.R2_SECRET_ACCESS_KEY ?? process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY;
  const accountId = process.env.R2_ACCOUNT_ID ?? process.env.CLOUDFLARE_ACCOUNT_ID;
  const endpoint =
    process.env.R2_ENDPOINT ??
    (accountId ? `https://${accountId}.r2.cloudflarestorage.com` : null);

  if (!bucket || !accessKeyId || !secretAccessKey || !endpoint) {
    throw new Error("R2 storage is not configured.");
  }

  const parsedEndpoint = new URL(endpoint);
  return {
    endpoint: parsedEndpoint.origin,
    hostname: parsedEndpoint.hostname,
    bucket,
    accessKeyId,
    secretAccessKey,
    region: process.env.R2_REGION ?? "auto",
  };
}

function encodePathSegment(value: string) {
  return encodeURIComponent(value).replace(/[!'()*]/g, (char) =>
    `%${char.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}

function encodeR2Path(key: string) {
  return key.split("/").map(encodePathSegment).join("/");
}

function encodeQueryValue(value: string) {
  return encodeURIComponent(value).replace(/[!'()*]/g, (char) =>
    `%${char.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}

function hmac(key: Buffer | string, value: string) {
  return createHmac("sha256", key).update(value).digest();
}

function hmacHex(key: Buffer | string, value: string) {
  return createHmac("sha256", key).update(value).digest("hex");
}

function getSigningKey(secretAccessKey: string, date: string, region: string) {
  const kDate = hmac(`AWS4${secretAccessKey}`, date);
  const kRegion = hmac(kDate, region);
  const kService = hmac(kRegion, "s3");
  return hmac(kService, "aws4_request");
}

function amzDate(now: Date) {
  const iso = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
  return {
    shortDate: iso.slice(0, 8),
    longDate: iso,
  };
}

function contentDisposition(disposition: "inline" | "attachment", fileName: string) {
  const safeName = fileName.replace(/[\\"]/g, "_");
  return `${disposition}; filename="${safeName}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;
}

function fileNameFromDisposition(disposition: string | undefined, fallback: string) {
  if (!disposition) return fallback;
  const match = disposition.match(/filename="?([^";]+)"?/i);
  return match?.[1] || fallback;
}

function dispositionFromHeader(value: string | undefined): "inline" | "attachment" {
  return value?.toLowerCase().startsWith("attachment") ? "attachment" : "inline";
}

function presignUrl(input: {
  method: "GET" | "PUT";
  key: string;
  query?: Record<string, string>;
  expiresSeconds?: number;
}) {
  const config = getR2Config();
  const now = new Date();
  const { shortDate, longDate } = amzDate(now);
  const credentialScope = `${shortDate}/${config.region}/s3/aws4_request`;
  const credential = `${config.accessKeyId}/${credentialScope}`;
  const canonicalUri = `/${encodePathSegment(config.bucket)}/${encodeR2Path(input.key)}`;
  const query: Record<string, string> = {
    "X-Amz-Algorithm": "AWS4-HMAC-SHA256",
    "X-Amz-Credential": credential,
    "X-Amz-Date": longDate,
    "X-Amz-Expires": String(input.expiresSeconds ?? SIGNED_URL_EXPIRES_SECONDS),
    "X-Amz-SignedHeaders": "host",
    ...(input.query ?? {}),
  };

  const canonicalQuery = Object.entries(query)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${encodeQueryValue(key)}=${encodeQueryValue(value)}`)
    .join("&");

  const canonicalHeaders = `host:${config.hostname}\n`;
  const canonicalRequest = [
    input.method,
    canonicalUri,
    canonicalQuery,
    canonicalHeaders,
    "host",
    "UNSIGNED-PAYLOAD",
  ].join("\n");
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    longDate,
    credentialScope,
    createHash("sha256").update(canonicalRequest).digest("hex"),
  ].join("\n");
  const signature = hmacHex(
    getSigningKey(config.secretAccessKey, shortDate, config.region),
    stringToSign,
  );

  return `${config.endpoint}${canonicalUri}?${canonicalQuery}&X-Amz-Signature=${signature}`;
}

export function createR2ObjectKey(fileName: string) {
  const extension = fileName.includes(".") ? fileName.split(".").pop()?.toLowerCase() : null;
  const suffix = extension ? `.${extension.replace(/[^a-z0-9]/g, "")}` : "";
  return `program-assets/${new Date().toISOString().slice(0, 10)}/${randomUUID()}${suffix}`;
}

export function getR2BucketName() {
  return getR2Config().bucket;
}

export function getSignedR2GetUrl(options: SignedGetOptions) {
  return presignUrl({
    method: "GET",
    key: options.key,
    expiresSeconds: options.expiresSeconds,
    query: {
      "response-content-disposition": contentDisposition(
        options.disposition,
        options.fileName,
      ),
      ...(options.contentType ? { "response-content-type": options.contentType } : {}),
    },
  });
}

export function getSignedR2PutUrl(options: SignedPutOptions) {
  return presignUrl({
    method: "PUT",
    key: options.key,
    expiresSeconds: options.expiresSeconds,
  });
}

export function getR2RemotePatternHost() {
  const endpoint = process.env.R2_ENDPOINT;
  if (endpoint) {
    try {
      return new URL(endpoint).hostname;
    } catch {
      return null;
    }
  }
  const accountId = process.env.R2_ACCOUNT_ID ?? process.env.CLOUDFLARE_ACCOUNT_ID;
  return accountId ? `${accountId}.r2.cloudflarestorage.com` : null;
}

// Backward-compatible aliases used by older routes that were merged with the R2 work.
export const createObjectKey = createR2ObjectKey;

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

export function createR2SignedUrl(options: CompatSignedUrlOptions) {
  if (options.method === "PUT") {
    return getSignedR2PutUrl({
      key: options.key,
      contentType: options.contentType ?? undefined,
      expiresSeconds: options.expiresSeconds,
    });
  }

  const fallbackName = options.key.split("/").pop() || "archivo";
  return getSignedR2GetUrl({
    key: options.key,
    fileName: options.fileName ?? fileNameFromDisposition(options.responseContentDisposition, fallbackName),
    contentType: options.contentType,
    disposition: dispositionFromHeader(options.responseContentDisposition),
    expiresSeconds: options.expiresSeconds,
  });
}
