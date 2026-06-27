import { NextResponse } from "next/server";

import { getSessionUser } from "@/lib/authz";
import { isCloudflareRuntime } from "@/lib/cloudflare/runtime";
import {
  extensionFromCampaignImageType,
  getAssetsBucket,
  isSupportedCampaignImageContentType,
  normalizeCampaignImageContentType,
} from "@/lib/cloudflare/r2";
import {
  getCloudinaryConfigState,
  uploadCampaignImageToCloudinary,
} from "@/lib/cloudinary-upload";
import { checkRateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

function statusCodeForSessionState(status: "unauthenticated" | "forbidden" | "inactive" | "ok") {
  if (status === "ok") return 200;
  if (status === "unauthenticated") return 401;
  return 403;
}

function safeFileName(value: string | null | undefined) {
  return String(value ?? "campaign-media")
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "campaign-media";
}

async function uploadCampaignImageToR2(params: { file: File; userId: string }) {
  const contentType = normalizeCampaignImageContentType(params.file.type);
  if (!isSupportedCampaignImageContentType(contentType)) {
    throw new Error("Solo se permiten imágenes PNG, JPG o WEBP para campañas de WhatsApp.");
  }

  const extension = extensionFromCampaignImageType(contentType);
  const key = `extension-campaigns/${params.userId}/${crypto.randomUUID()}.${extension}`;
  const bytes = await params.file.arrayBuffer();
  await getAssetsBucket().put(key, bytes, {
    httpMetadata: {
      contentType,
      contentDisposition: `inline; filename="${safeFileName(params.file.name)}"`,
    },
    customMetadata: {
      userId: params.userId,
      originalName: safeFileName(params.file.name),
      uploadedAt: new Date().toISOString(),
    },
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
    const asset = isCloudflareRuntime()
      ? await uploadCampaignImageToR2({
          file,
          userId: session.user.id,
        })
      : await uploadCampaignImageToCloudinary({
          file,
          userId: session.user.id,
        });

    return NextResponse.json({
      ok: true,
      asset,
      cloudinary: isCloudflareRuntime() ? { ready: false, missing: [] } : getCloudinaryConfigState(),
      storage: isCloudflareRuntime() ? "cloudflare-r2" : "cloudinary",
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "No fue posible subir la imagen.",
        cloudinary: isCloudflareRuntime() ? { ready: false, missing: [] } : getCloudinaryConfigState(),
        storage: isCloudflareRuntime() ? "cloudflare-r2" : "cloudinary",
      },
      { status: 400 },
    );
  }
}
