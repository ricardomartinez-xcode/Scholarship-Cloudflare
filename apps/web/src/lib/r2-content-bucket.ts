import { createHash, createHmac } from "node:crypto";

const DEFAULT_CONTENT_BUCKET = "planes-de-estudio";
const DEFAULT_CONTENT_ENDPOINT = "https://38485f8c296aaf6f6d7aee9f82036880.r2.cloudflarestorage.com";

export type ContentBucketObject = {
  key: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number | null;
  lastModified: string | null;
  previewUrl: string;
  downloadUrl: string;
};

type R2ContentConfig = {
  bucket: string;
  endpoint: string;
  publicBaseUrl: string;
  prefix: string;
  accessKeyId: string | null;
  secretAccessKey: string | null;
  region: string;
};

function trimSlashes(value: string) {
  return value.replace(/^\/+|\/+$/g, "");
}

function getConfig(): R2ContentConfig {
  const bucket = process.env.R2_CONTENT_BUCKET ?? DEFAULT_CONTENT_BUCKET;
  const endpoint = process.env.R2_CONTENT_ENDPOINT ?? process.env.R2_ENDPOINT ?? DEFAULT_CONTENT_ENDPOINT;
  const publicBaseUrl =
    process.env.R2_CONTENT_PUBLIC_BASE_URL ??
    process.env.NEXT_PUBLIC_R2_CONTENT_BASE_URL ??
    "";

  return {
    bucket,
    endpoint: endpoint.replace(/\/+$/g, ""),
    publicBaseUrl: trimSlashes(publicBaseUrl),
    prefix: trimSlashes(process.env.R2_CONTENT_PREFIX ?? ""),
    accessKeyId: process.env.R2_CONTENT_ACCESS_KEY_ID ?? process.env.R2_ACCESS_KEY_ID ?? process.env.CLOUDFLARE_R2_ACCESS_KEY_ID ?? null,
    secretAccessKey:
      process.env.R2_CONTENT_SECRET_ACCESS_KEY ??
      process.env.R2_SECRET_ACCESS_KEY ??
      process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY ??
      null,
    region: process.env.R2_CONTENT_REGION ?? process.env.R2_REGION ?? "auto",
  };
}

function encodePathSegment(value: string) {
  return encodeURIComponent(value).replace(/[!'()*]/g, (char) =>
    `%${char.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}

function encodePath(value: string) {
  return value.split("/").map(encodePathSegment).join("/");
}

function encodeQueryValue(value: string) {
  return encodeURIComponent(value).replace(/[!'()*]/g, (char) =>
    `%${char.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}

export function buildContentBucketPublicUrl(key: string) {
  const config = getConfig();
  const normalizedKey = trimSlashes(key);
  if (config.publicBaseUrl) {
    return `${config.publicBaseUrl}/${encodePath(normalizedKey)}`;
  }
  return `/api/content-bucket/${encodePath(normalizedKey)}`;
}

function buildContentBucketDownloadUrl(key: string) {
  const config = getConfig();
  const normalizedKey = trimSlashes(key);
  if (config.publicBaseUrl) {
    return `${config.publicBaseUrl}/${encodePath(normalizedKey)}`;
  }
  return `/api/content-bucket/${encodePath(normalizedKey)}?download=1`;
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

function toContentObject(input: {
  key: string;
  sizeBytes?: number | null;
  lastModified?: string | null;
  contentType?: string | null;
}): ContentBucketObject {
  const key = trimSlashes(input.key);
  const previewUrl = buildContentBucketPublicUrl(key);
  return {
    key,
    fileName: decodeURIComponent(key.split("/").pop() ?? key),
    mimeType: input.contentType || inferMimeType(key),
    sizeBytes: input.sizeBytes ?? null,
    lastModified: input.lastModified ?? null,
    previewUrl,
    downloadUrl: buildContentBucketDownloadUrl(key),
  };
}

export function getContentBucketName() {
  return getConfig().bucket;
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
  return { shortDate: iso.slice(0, 8), longDate: iso };
}

function signListObjectsUrl(config: R2ContentConfig, continuationToken?: string) {
  if (!config.accessKeyId || !config.secretAccessKey) return null;

  const now = new Date();
  const { shortDate, longDate } = amzDate(now);
  const credentialScope = `${shortDate}/${config.region}/s3/aws4_request`;
  const credential = `${config.accessKeyId}/${credentialScope}`;
  const prefix = config.prefix ? `${config.prefix}/` : "";
  const query: Record<string, string> = {
    "X-Amz-Algorithm": "AWS4-HMAC-SHA256",
    "X-Amz-Credential": credential,
    "X-Amz-Date": longDate,
    "X-Amz-Expires": "300",
    "X-Amz-SignedHeaders": "host",
    "list-type": "2",
    "max-keys": "1000",
    ...(prefix ? { prefix } : {}),
    ...(continuationToken ? { "continuation-token": continuationToken } : {}),
  };
  const endpoint = new URL(config.endpoint);
  const canonicalUri = `/${encodeURIComponent(config.bucket)}`;
  const canonicalQuery = Object.entries(query)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${encodeQueryValue(key)}=${encodeQueryValue(value)}`)
    .join("&");
  const canonicalHeaders = `host:${endpoint.hostname}\n`;
  const canonicalRequest = [
    "GET",
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

function contentDisposition(disposition: "inline" | "attachment", fileName: string) {
  const safeName = fileName.replace(/[\\"]/g, "_");
  return `${disposition}; filename="${safeName}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;
}

export function getSignedContentBucketGetUrl(options: {
  key: string;
  fileName?: string | null;
  contentType?: string | null;
  disposition: "inline" | "attachment";
  expiresSeconds?: number;
}) {
  const config = getConfig();
  if (!config.accessKeyId || !config.secretAccessKey) {
    throw new Error("R2 content bucket is not configured.");
  }

  const now = new Date();
  const { shortDate, longDate } = amzDate(now);
  const credentialScope = `${shortDate}/${config.region}/s3/aws4_request`;
  const credential = `${config.accessKeyId}/${credentialScope}`;
  const endpoint = new URL(config.endpoint);
  const key = trimSlashes(options.key);
  const fileName = options.fileName ?? decodeURIComponent(key.split("/").pop() || "archivo");
  const query: Record<string, string> = {
    "X-Amz-Algorithm": "AWS4-HMAC-SHA256",
    "X-Amz-Credential": credential,
    "X-Amz-Date": longDate,
    "X-Amz-Expires": String(options.expiresSeconds ?? 600),
    "X-Amz-SignedHeaders": "host",
    "response-content-disposition": contentDisposition(options.disposition, fileName),
    ...(options.contentType ? { "response-content-type": options.contentType } : {}),
  };
  const canonicalUri = `/${encodePathSegment(config.bucket)}/${encodePath(key)}`;
  const canonicalQuery = Object.entries(query)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([queryKey, value]) => `${encodeQueryValue(queryKey)}=${encodeQueryValue(value)}`)
    .join("&");
  const canonicalHeaders = `host:${endpoint.hostname}\n`;
  const canonicalRequest = [
    "GET",
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

function readXmlValue(xml: string, tag: string) {
  const match = xml.match(new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`));
  return match?.[1]?.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">") ?? null;
}

function parseListObjectsXml(xml: string) {
  const contents = Array.from(xml.matchAll(/<Contents>([\s\S]*?)<\/Contents>/g)).map((match) => {
    const block = match[1] ?? "";
    const key = readXmlValue(block, "Key");
    if (!key) return null;
    const sizeRaw = readXmlValue(block, "Size");
    return toContentObject({
      key,
      sizeBytes: sizeRaw ? Number(sizeRaw) : null,
      lastModified: readXmlValue(block, "LastModified"),
    });
  });

  return {
    objects: contents.filter((item): item is ContentBucketObject => Boolean(item)),
    nextContinuationToken: readXmlValue(xml, "NextContinuationToken"),
  };
}

async function listWithSignedR2Api(config: R2ContentConfig) {
  const objects: ContentBucketObject[] = [];
  let token: string | undefined;

  for (let page = 0; page < 5; page += 1) {
    const url = signListObjectsUrl(config, token);
    if (!url) return null;
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) return null;
    const parsed = parseListObjectsXml(await response.text());
    objects.push(...parsed.objects);
    if (!parsed.nextContinuationToken) break;
    token = parsed.nextContinuationToken;
  }

  return objects;
}

async function listWithManifest(config: R2ContentConfig) {
  const manifestUrl = process.env.R2_CONTENT_MANIFEST_URL ?? `${config.publicBaseUrl}/manifest.json`;
  const response = await fetch(manifestUrl, { cache: "no-store" }).catch(() => null);
  if (!response?.ok) return [];
  const payload = (await response.json().catch(() => null)) as
    | Array<string | { key?: string; name?: string; sizeBytes?: number; size?: number; mimeType?: string; contentType?: string; lastModified?: string }>
    | { files?: Array<string | { key?: string; name?: string; sizeBytes?: number; size?: number; mimeType?: string; contentType?: string; lastModified?: string }> }
    | null;
  const files = Array.isArray(payload) ? payload : payload?.files;
  if (!Array.isArray(files)) return [];

  return files
    .map((item) => {
      if (typeof item === "string") return toContentObject({ key: item });
      const key = item.key ?? item.name;
      if (!key) return null;
      return toContentObject({
        key,
        sizeBytes: item.sizeBytes ?? item.size ?? null,
        contentType: item.mimeType ?? item.contentType ?? null,
        lastModified: item.lastModified ?? null,
      });
    })
    .filter((item): item is ContentBucketObject => Boolean(item));
}

export async function listContentBucketObjects() {
  const config = getConfig();
  const signedObjects = await listWithSignedR2Api(config).catch(() => null);
  const objects = signedObjects ?? (await listWithManifest(config));
  return objects
    .filter((item) => item.key && !item.key.endsWith("/"))
    .sort((left, right) => left.fileName.localeCompare(right.fileName, "es"));
}
