import { NextResponse } from "next/server";

import { getSessionUser } from "@/lib/authz";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function statusCodeForSessionState(status: "unauthenticated" | "forbidden" | "inactive" | "ok") {
  if (status === "ok") return 200;
  if (status === "unauthenticated") return 401;
  return 403;
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
  if (!campaignId) {
    return NextResponse.json(
      { ok: false, error: "Debes indicar el campaignId del asset." },
      { status: 400 },
    );
  }

  const campaign = await prisma.extensionCampaign.findFirst({
    where: {
      id: campaignId,
      ownerUserId: session.user.id,
    },
    select: {
      campaignName: true,
      mediaUrl: true,
    },
  });

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

    const contentType = upstream.headers.get("content-type") || "application/octet-stream";
    const extension =
      contentType.includes("png")
        ? "png"
        : contentType.includes("webp")
          ? "webp"
          : contentType.includes("gif")
            ? "gif"
            : "jpg";

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
