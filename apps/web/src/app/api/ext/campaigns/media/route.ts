import { NextResponse } from "next/server";

import { getSessionUser } from "@/lib/authz";
import {
  STORAGE_BUCKETS,
  downloadStorageObject,
  extensionFromImageContentType,
  isSupportedImageContentType,
  normalizeImageContentType,
} from "@/lib/storage/supabase-storage";

export const dynamic = "force-dynamic";

function statusCodeForSessionState(status: "unauthenticated" | "forbidden" | "inactive" | "ok") {
  if (status === "ok") return 200;
  if (status === "unauthenticated") return 401;
  return 403;
}


function normalizeMediaContentType(value: string | null | undefined, mediaUrl?: string | null) {
  const raw = String(value ?? "").split(";")[0].trim().toLowerCase();
  if (raw === "image/jpg" || raw === "image/pjpeg" || raw === "image/jfif") return "image/jpeg";
  if (raw === "image/jpeg" || raw === "image/png" || raw === "image/webp") return raw;

  const pathname = (() => {
    try {
      return new URL(String(mediaUrl ?? "")).pathname.toLowerCase();
    } catch {
      return "";
    }
  })();

  if (pathname.endsWith(".png")) return "image/png";
  if (pathname.endsWith(".webp")) return "image/webp";
  if (pathname.endsWith(".jfif") || pathname.endsWith(".jpg") || pathname.endsWith(".jpeg")) {
    return "image/jpeg";
  }

  return "application/octet-stream";
}

function extensionFromContentType(contentType: string) {
  if (contentType === "image/png") return "png";
  if (contentType === "image/webp") return "webp";
  return "jpg";
}

function safeCampaignFileName(value: string | null | undefined) {
  return String(value ?? "campana")
    .toLowerCase()
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || "campana";
}

function extractStorageAssetKey(value: string | null | undefined, requestUrl: string) {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  if (raw.startsWith("extension-campaigns/")) return raw;
  try {
    const url = new URL(raw, requestUrl);
    const key = url.searchParams.get("assetKey")?.trim() ?? "";
    return key.startsWith("extension-campaigns/") ? key : null;
  } catch {
    return null;
  }
}

async function readStorageCampaignMedia(params: {
  userId: string;
  assetKey: string | null;
  campaignName?: string | null;
}) {
  if (!params.assetKey || !params.assetKey.startsWith(`extension-campaigns/${params.userId}/`)) {
    return NextResponse.json(
      { ok: false, error: "El asset solicitado no pertenece a esta sesión." },
      { status: 403 },
    );
  }

  const object = await downloadStorageObject({
    bucket: STORAGE_BUCKETS.attachments,
    key: params.assetKey,
  });
  if (!object) {
    return NextResponse.json(
      { ok: false, error: "No fue posible recuperar la imagen de la campaña." },
      { status: 404 },
    );
  }

  const contentType = normalizeImageContentType(object.type) || normalizeMediaContentType(null, params.assetKey);
  if (!isSupportedImageContentType(contentType)) {
    return NextResponse.json(
      {
        ok: false,
        error: `La imagen de campaña debe ser PNG, JPG o WEBP. Se recibió: ${contentType || "desconocido"}.`,
      },
      { status: 415 },
    );
  }

  const fileName =
    `${safeCampaignFileName(params.campaignName)}.${extensionFromImageContentType(contentType)}`;

  return new NextResponse(object.stream(), {
    status: 200,
    headers: {
      "content-type": contentType,
      "cache-control": "private, no-store, max-age=0",
      "content-disposition": `inline; filename="${fileName}"`,
    },
  });
}

export async function GET(request: Request) {
  const session = await getSessionUser();
  if (session.status !== "ok") {
    return NextResponse.json(
      { ok: false, error: session.status },
      { status: statusCodeForSessionState(session.status) },
    );
  }

  const url = new URL(request.url);
  const campaignId = url.searchParams.get("campaignId")?.trim() ?? "";
  const assetKey = url.searchParams.get("assetKey")?.trim() ?? null;
  if (!campaignId && !assetKey) {
    return NextResponse.json(
      { ok: false, error: "Debes indicar el campaignId o assetKey del asset." },
      { status: 400 },
    );
  }

  const { prisma } = await import("@/lib/prisma");
  const campaign = campaignId
    ? await prisma.extensionCampaign.findFirst({
        where: {
          id: campaignId,
          ownerUserId: session.user.id,
        },
        select: {
          campaignName: true,
          mediaUrl: true,
        },
      })
    : null;

  if (campaignId && !campaign?.mediaUrl) {
    return NextResponse.json(
      { ok: false, error: "La campaña no tiene imagen asociada." },
      { status: 404 },
    );
  }

  const storageAssetKey =
    assetKey ?? extractStorageAssetKey(campaign?.mediaUrl ?? null, request.url);
  if (storageAssetKey) {
    return readStorageCampaignMedia({
      userId: session.user.id,
      assetKey: storageAssetKey,
      campaignName: campaign?.campaignName ?? null,
    });
  }

  if (!campaign?.mediaUrl) {
    return NextResponse.json(
      { ok: false, error: "La campaña no tiene imagen asociada." },
      { status: 404 },
    );
  }

  try {
    const upstream = await fetch(campaign.mediaUrl, {
      cache: "no-store",
    });

    if (!upstream.ok || !upstream.body) {
      return NextResponse.json(
        { ok: false, error: "No fue posible recuperar la imagen de la campaña." },
        { status: 502 },
      );
    }

    const contentType = normalizeMediaContentType(
      upstream.headers.get("content-type"),
      campaign.mediaUrl,
    );
    if (!isSupportedImageContentType(contentType)) {
      return NextResponse.json(
        {
          ok: false,
          error: `La imagen de campaña debe ser PNG, JPG o WEBP. Se recibió: ${contentType}.`,
        },
        { status: 415 },
      );
    }
    const extension = extensionFromContentType(contentType);

    const safeName = campaign.campaignName
      .toLowerCase()
      .replace(/[^a-z0-9]+/gi, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48) || "campana";

    return new NextResponse(upstream.body, {
      status: 200,
      headers: {
        "content-type": contentType,
        "cache-control": "private, no-store, max-age=0",
        "content-disposition": `inline; filename="${safeName}.${extension}"`,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "No fue posible recuperar la imagen de la campaña.",
      },
      { status: 500 },
    );
  }
}
