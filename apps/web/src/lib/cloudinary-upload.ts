import { createHash } from "node:crypto";

type CloudinaryUploadResult = {
  secureUrl: string;
  publicId: string;
  bytes: number | null;
  format: string | null;
  resourceType: string | null;
};

function getCloudinaryEnv() {
  return {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME?.trim() ?? "",
    apiKey: process.env.CLOUDINARY_API_KEY?.trim() ?? "",
    apiSecret: process.env.CLOUDINARY_API_SECRET?.trim() ?? "",
    folder:
      process.env.CLOUDINARY_EXTENSION_CAMPAIGN_FOLDER?.trim() ??
      "recalc/extension-campaigns",
  };
}

export function getCloudinaryConfigState() {
  const env = getCloudinaryEnv();
  return {
    ready: Boolean(env.cloudName) && Boolean(env.apiKey) && Boolean(env.apiSecret),
    missing: Object.entries({
      CLOUDINARY_CLOUD_NAME: env.cloudName,
      CLOUDINARY_API_KEY: env.apiKey,
      CLOUDINARY_API_SECRET: env.apiSecret,
    })
      .filter(([, value]) => !value)
      .map(([key]) => key),
  };
}

function buildCloudinarySignature(params: Record<string, string>, apiSecret: string) {
  const base = Object.entries(params)
    .filter(([, value]) => value)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${value}`)
    .join("&");

  return createHash("sha1").update(`${base}${apiSecret}`).digest("hex");
}

export async function uploadCampaignImageToCloudinary(params: {
  file: File;
  userId: string;
}) {
  const env = getCloudinaryEnv();
  if (!env.cloudName || !env.apiKey || !env.apiSecret) {
    throw new Error(
      "Configura CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY y CLOUDINARY_API_SECRET antes de subir imágenes.",
    );
  }

  if (!params.file.type.startsWith("image/")) {
    throw new Error("Solo se permiten archivos de imagen.");
  }

  const timestamp = String(Math.floor(Date.now() / 1000));
  const folder = `${env.folder}/${params.userId}`;
  const signature = buildCloudinarySignature(
    {
      folder,
      timestamp,
    },
    env.apiSecret,
  );

  const body = new FormData();
  body.set("file", params.file);
  body.set("api_key", env.apiKey);
  body.set("timestamp", timestamp);
  body.set("signature", signature);
  body.set("folder", folder);

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${encodeURIComponent(env.cloudName)}/image/upload`,
    {
      method: "POST",
      body,
    },
  );

  const payload = (await response.json().catch(() => null)) as
    | {
        secure_url?: string;
        public_id?: string;
        bytes?: number;
        format?: string;
        resource_type?: string;
        error?: { message?: string };
      }
    | null;

  if (!response.ok || !payload?.secure_url || !payload.public_id) {
    throw new Error(
      payload?.error?.message || "Cloudinary no devolvió una URL válida para la imagen.",
    );
  }

  return {
    secureUrl: payload.secure_url,
    publicId: payload.public_id,
    bytes: typeof payload.bytes === "number" ? payload.bytes : null,
    format: payload.format ?? null,
    resourceType: payload.resource_type ?? null,
  } satisfies CloudinaryUploadResult;
}
