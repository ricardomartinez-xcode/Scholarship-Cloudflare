import { NextResponse } from "next/server";

import { getSessionUser } from "@/lib/authz";
import { downloadWhatsAppMedia, getWhatsAppMediaMetadata } from "@/lib/meta-whatsapp";

export const dynamic = "force-dynamic";

function statusCodeForSessionState(status: "unauthenticated" | "forbidden" | "inactive" | "ok") {
  if (status === "ok") return 200;
  if (status === "unauthenticated") return 401;
  return 403;
}

export async function GET(
  request: Request,
  context: { params: Promise<{ mediaId: string }> },
) {
  const session = await getSessionUser();
  if (session.status !== "ok") {
    return NextResponse.json(
      { ok: false, error: session.status },
      { status: statusCodeForSessionState(session.status) },
    );
  }

  const { mediaId } = await context.params;
  const { searchParams } = new URL(request.url);
  const shouldDownload = searchParams.get("download") === "1";

  try {
    if (shouldDownload) {
      const file = await downloadWhatsAppMedia({
        userId: session.user.id,
        mediaId,
      });

      return new NextResponse(file.arrayBuffer, {
        status: 200,
        headers: {
          "Content-Type": file.contentType,
          "Content-Disposition": `inline; filename="${file.fileName}"`,
        },
      });
    }

    const media = await getWhatsAppMediaMetadata({
      userId: session.user.id,
      mediaId,
    });
    return NextResponse.json({ ok: true, media });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "meta_media_lookup_failed",
      },
      { status: 500 },
    );
  }
}
