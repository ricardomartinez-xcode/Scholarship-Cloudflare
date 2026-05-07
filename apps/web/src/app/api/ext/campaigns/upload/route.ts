import { NextResponse } from "next/server";

import { getSessionUser } from "@/lib/authz";
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

export async function POST(request: Request) {
  const session = await getSessionUser();
  if (session.status !== "ok") {
    return NextResponse.json(
      { ok: false, error: session.status },
      { status: statusCodeForSessionState(session.status) },
    );
  }

  const limiter = checkRateLimit(`ext-campaign-upload:${session.user.id}`, {
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
    const asset = await uploadCampaignImageToCloudinary({
      file,
      userId: session.user.id,
    });

    return NextResponse.json({
      ok: true,
      asset,
      cloudinary: getCloudinaryConfigState(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "No fue posible subir la imagen a Cloudinary.",
        cloudinary: getCloudinaryConfigState(),
      },
      { status: 400 },
    );
  }
}
