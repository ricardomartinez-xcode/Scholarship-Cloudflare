import crypto from "node:crypto";

const DEFAULT_MAX_UPLOAD_BYTES = 20 * 1024 * 1024;

export const PREVIEWABLE_MIME_TYPES = new Set(["application/pdf", "image/png", "image/jpeg", "image/webp"]);

export const ALLOWED_FILE_MIME_TYPES = new Set([
  ...PREVIEWABLE_MIME_TYPES,
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
]);

type SignedUrlOptions = {
  method: "GET" | "PUT";
  key: string;
  expiresSeconds?: number;
  responseContentDisposition?: string;
};

function requiredEnv(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

function getR2Config() {
  const accountId = process.env.R2_ACCOUNT_ID;
  const endpoint = process.env.R2_ENDPOINT || (accountId ? `https://${accountId}.r2.cloudflarestorage.com` : undefined);
  return {
    endpoint: endpoint ? endpoint.replace(/\/+$/, "") : requiredEnv("R2_ENDPOINT"),
    bucket: requiredEnv("R2_BUCKET"),
    accessKeyId: requiredEnv("R2_ACCESS_KEY_ID"),
    secretAccessKey: requiredEnv("R2_SECRET_ACCESS_KEY"),
  };
}

function hmac(key: crypto.BinaryLike | crypto.KeyObject, value: string) {
  return crypto.createHmac("sha256", key).update(value, "utf8").digest();
}

function sha256Hex(value: string) {
  return crypto.createHash("sha256").update(value, "utf8").digest("hex");
}

function encodePathSegment(value: string) {
  return encodeURIComponent(value).replace(/[!'()*]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`);
}

function toAmzDate(date: Date) {
  return date.toISOString().replace(/[:-]|\.\d{3}/g, "");
}

function toDateStamp(date: Date) {
  return toAmzDate(date).slice(0, 8);
}

function getCanonicalUri(endpoint: string, bucket: string, key: string) {
  const url = new URL(endpoint);
  const basePath = url.pathname.replace(/\/+$/, "");
  const endpointAlreadyIncludesBucket = basePath.split("/").filter(Boolean).at(-1) === bucket;
  const bucketPath = endpointAlreadyIncludesBucket ? basePath : `${basePath}/${bucket}`;
  return `${bucketPath}/${key.split("/").map(encodePathSegment).join("/")}`.replace(/\/+/g, "/");
}

export function getMaxUploadBytes() {
  const configured = Number(process.env.MAX_UPLOAD_BYTES);
  return Number.isFinite(configured) && configured > 0 ? configured : DEFAULT_MAX_UPLOAD_BYTES;
}

export function createObjectKey(fileName: string) {
  const safeName = fileName
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120) || "archivo";
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  return `uploads/${year}/${month}/${crypto.randomUUID()}-${safeName}`;
}

export function isAllowedFileMimeType(mimeType: string) {
  return ALLOWED_FILE_MIME_TYPES.has(mimeType);
}

export function isPreviewableMimeType(mimeType: string) {
  return PREVIEWABLE_MIME_TYPES.has(mimeType);
}

export function getR2BucketName() {
  return getR2Config().bucket;
}

export function createR2SignedUrl(options: SignedUrlOptions) {
  const { endpoint, bucket, accessKeyId, secretAccessKey } = getR2Config();
  const now = new Date();
  const amzDate = toAmzDate(now);
  const dateStamp = toDateStamp(now);
  const region = "auto";
  const service = "s3";
  const expiresSeconds = String(Math.min(Math.max(options.expiresSeconds ?? 900, 60), 60 * 60 * 24));
  const endpointUrl = new URL(endpoint);
  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
  const credential = `${accessKeyId}/${credentialScope}`;
  const canonicalUri = getCanonicalUri(endpoint, bucket, options.key);
  const query = new URLSearchParams({
    "X-Amz-Algorithm": "AWS4-HMAC-SHA256",
    "X-Amz-Credential": credential,
    "X-Amz-Date": amzDate,
    "X-Amz-Expires": expiresSeconds,
    "X-Amz-SignedHeaders": "host",
  });
  if (options.responseContentDisposition) {
    query.set("response-content-disposition", options.responseContentDisposition);
  }
  const canonicalQueryString = Array.from(query.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join("&");
  const canonicalHeaders = `host:${endpointUrl.host}\n`;
  const canonicalRequest = [options.method, canonicalUri, canonicalQueryString, canonicalHeaders, "host", "UNSIGNED-PAYLOAD"].join("\n");
  const stringToSign = ["AWS4-HMAC-SHA256", amzDate, credentialScope, sha256Hex(canonicalRequest)].join("\n");
  const signingKey = hmac(hmac(hmac(hmac(`AWS4${secretAccessKey}`, dateStamp), region), service), "aws4_request");
  const signature = crypto.createHmac("sha256", signingKey).update(stringToSign, "utf8").digest("hex");
  query.set("X-Amz-Signature", signature);
  return `${endpointUrl.origin}${canonicalUri}?${query.toString()}`;
}
