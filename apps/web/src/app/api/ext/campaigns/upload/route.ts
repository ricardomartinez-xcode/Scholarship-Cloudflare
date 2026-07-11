import { NextResponse } from "next/server";

import { getSessionUser } from "@/lib/authz";
import {
  STORAGE_BUCKETS,
  extensionFromImageContentType,
  isSupportedImageContentType,
  normalizeImageContentType,
  uploadStorageObject,
} from "@/lib/storage/supabase-storage";
import { checkRateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

function statusCodeForSessionState(status: "unauthenticated" | "forbidden" | "inactive" | "ok") {
  if (status === "ok") return 200;
  if (status === "unauthenticated") return 401;
  return 403;
}

async function uploadCampaignImageToStorage(params: { file: File; userId: string }) {
  const contentType = normalizeImageContentType(params.file.type);
  if (!isSupportedImageContentType(contentType)) {
    throw new Error("Solo se permiten imágenes PNG, JPG o WEBP para campañas de WhatsApp.");
  }

  const extension = extensionFromImageContentType(contentType);
  const key = `extension-campaigns/${params.userId}/${crypto.randomUUID()}.${extension}`;
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
    format: extension,
    resourceType: "image",
  };
}

export async function POST(request: Request) {
  const session = await getSessionUser();
  if (session.status !== "ok") {
    return NextResponse.json(
      { ok: false, error: session.status },
      { status: statusCodeForSessionState(session.status) },
    );
  }

  const limiter = await checkRateLimit(`ext-campaign-upload:${session.user.id}`, {
    limit: 10,
    windowMs: 10 * 60_000,
  });
  if (!limiter.ok) {
    return NextResponse.json(
      { ok: false, error: "rate_limited", retryAfterMs: limiter.retryAfterMs },
      { status: 429 },
    );
  }

  const formData = await request.formData().catch(() => null);
  const file = formData?.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json(
      { ok: false, error: "Debes adjuntar una imagen válida." },
      { status: 400 },
    );
  }

  try {
    const asset = await uploadCampaignImageToStorage({
      file,
      userId: session.user.id,
    });

    return NextResponse.json({
      ok: true,
      asset,
      storage: "supabase-storage",
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "No fue posible subir la imagen.",
        storage: "supabase-storage",
      },
      { status: 400 },
    );
  }
}
