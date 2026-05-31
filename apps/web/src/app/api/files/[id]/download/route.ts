import { NextResponse } from "next/server";

import { getSessionUser } from "@/lib/authz";
import { getFileAssetById } from "@/lib/file-assets";
import { getSignedR2GetUrl } from "@/lib/r2-storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function statusCodeForSessionState(status: "unauthenticated" | "forbidden" | "inactive" | "ok") {
  if (status === "unauthenticated") return 401;
  if (status === "ok") return 200;
  return 403;
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const session = await getSessionUser();
  if (session.status !== "ok") {
    return NextResponse.json(
      { ok: false, error: session.status },
      { status: statusCodeForSessionState(session.status) },
    );
  }

  const { id } = await context.params;
  const file = await getFileAssetById(id);
  if (!file || file.status !== "uploaded") {
    return NextResponse.json({ ok: false, error: "Archivo no encontrado." }, { status: 404 });
  }

  const signedUrl = getSignedR2GetUrl({
    key: file.r2Key,
    fileName: file.fileName,
    contentType: file.mimeType,
    disposition: "attachment",
  });

  return NextResponse.redirect(signedUrl, {
    status: 302,
    headers: { "Cache-Control": "private, no-store" },
  });
}
