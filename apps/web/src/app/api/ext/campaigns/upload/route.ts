import { NextResponse } from "next/server";

import { getSessionUser } from "@/lib/authz";
import { STORAGE_BUCKETS, uploadStorageObject } from "@/lib/storage/supabase-storage";
import { checkRateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

const MAX_MEDIA_BYTES = 32 * 1024 * 1024;
const MEDIA_TYPES = new Map([
  ["image/jpeg", { extension: "jpg", resourceType: "image" }],
  ["image/png", { extension: "png", resourceType: "image" }],
  ["image/webp", { extension: "webp", resourceType: "image" }],
  ["video/mp4", { extension: "mp4", resourceType: "video" }],
  ["video/webm", { extension: "webm", resourceType: "video" }],
] as const);

function statusCodeForSessionState(status: "unauthenticated" | "forbidden" | "inactive" | "ok") {
  if (status === "ok") return 200;
  if (status === "unauthenticated") return 401;
  return 403;
}

function normalizeMediaType(value: string | null | undefined) {
  const raw = String(value ?? "").split(";")[0].trim().toLowerCase();
  if (["image/jpg", "image/pjpeg", "image/jfif"].includes(raw)) return "image/jpeg";
  return raw;
}

async function uploadCampaignMedia(params: { file: File; userId: string }) {
  const contentType = normalizeMediaType(params.file.type);
  const config = MEDIA_TYPES.get(contentType as "image/jpeg" | "image/png" | "image/webp" | "video/mp4" | "video/webm");
  if (!config) {
    throw new Error("Solo se permiten JPG, PNG, WEBP, MP4 o WEBM para campañas de WhatsApp.");
  }
  if (params.file.size <= 0 || params.file.size > MAX_MEDIA_BYTES) {
    throw new Error("El archivo debe pesar entre 1 byte y 32 MB.");
  }

  const key = `extension-campaigns/${params.userId}/${crypto.randomUUID()}.${config.extension}`;
  const bytes = await params.file.arrayBuffer();
  await uploadStorageObject({
    bucket: STORAGE_BUCKETS.attachments,
    key,
    body: bytes,
    contentType,
  });

  return {
    secureUrl: `/api/ext/campaigns/media?assetKey=${encodeURIComponent(key)}`,
    publicId: key,
    bytes: bytes.byteLength,
    format: config.extension,
    resourceType: config.resourceType,
    contentType,
  };
}

export async function POST(request: Request) {
  const session = await getSessionUser();
  if (session.status !== "ok") {
    return NextResponse.json({ ok: false, error: session.status }, { status: statusCodeForSessionState(session.status) });
  }

  const limiter = await checkRateLimit(`ext-campaign-upload:${session.user.id}`, {
    limit: 10,
    windowMs: 10 * 60_000,
  });
  if (!limiter.ok) {
    return NextResponse.json({ ok: false, error: "rate_limited", retryAfterMs: limiter.retryAfterMs }, { status: 429 });
  }

  const formData = await request.formData().catch(() => null);
  const file = formData?.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ ok: false, error: "Debes adjuntar una imagen o video válido." }, { status: 400 });
  }

  try {
    const asset = await uploadCampaignMedia({ file, userId: session.user.id });
    return NextResponse.json({ ok: true, asset, storage: "supabase-storage" });
  } catch (error) {
    return NextResponse.json({
      ok: false,
      error: error instanceof Error ? error.message : "No fue posible subir el archivo multimedia.",
      storage: "supabase-storage",
    }, { status: 400 });
  }
}
