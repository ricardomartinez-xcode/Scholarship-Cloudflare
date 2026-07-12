import { getCloudflareContext } from "@opennextjs/cloudflare";

type R2PutOptions = {
  httpMetadata?: {
    contentType?: string;
    contentDisposition?: string;
  };
  customMetadata?: Record<string, string>;
};

type R2Object = {
  body: ReadableStream;
  httpMetadata?: {
    contentType?: string;
    contentDisposition?: string;
  };
  customMetadata?: Record<string, string>;
  size?: number;
};

type R2BucketBinding = {
  put(key: string, value: ArrayBuffer | ReadableStream | Blob | string, options?: R2PutOptions): Promise<unknown>;
  get(key: string): Promise<R2Object | null>;
};

type CloudflareR2Env = {
  Assets?: R2BucketBinding;
  ASSETS?: R2BucketBinding;
};

export function getAssetsBucket() {
  const { env } = getCloudflareContext();
  const bucket = (env as unknown as CloudflareR2Env).Assets;
  if (!bucket) {
    throw new Error("Cloudflare R2 binding Assets is not configured.");
  }
  return bucket;
}

export function normalizeCampaignImageContentType(value: string | null | undefined) {
  const raw = String(value ?? "").split(";")[0].trim().toLowerCase();
  if (raw === "image/jpg" || raw === "image/pjpeg" || raw === "image/jfif") return "image/jpeg";
  if (raw === "image/jpeg" || raw === "image/png" || raw === "image/webp") return raw;
  return "";
}

export function extensionFromCampaignImageType(contentType: string) {
  if (contentType === "image/png") return "png";
  if (contentType === "image/webp") return "webp";
  return "jpg";
}

export function isSupportedCampaignImageContentType(contentType: string) {
  return contentType === "image/jpeg" || contentType === "image/png" || contentType === "image/webp";
}

