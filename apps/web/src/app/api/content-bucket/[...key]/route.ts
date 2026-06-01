import { NextResponse } from "next/server";

import { getSessionUser } from "@/lib/authz";
import {
  getSignedContentBucketGetUrl,
  buildContentBucketPublicUrl,
} from "@/lib/r2-content-bucket";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function statusCodeForSessionState(
  status: "unauthenticated" | "forbidden" | "inactive" | "ok",
) {
  if (status === "unauthenticated") return 401;
  if (status === "ok") return 200;
  return 403;
}

function inferMimeType(key: string) {
  const ext = key.split(".").pop()?.toLowerCase();
  if (ext === "pdf") return "application/pdf";
  if (ext === "png") return "image/png";
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  if (ext === "webp") return "image/webp";
  if (ext === "mp4") return "video/mp4";
  if (ext === "webm") return "video/webm";
  return "application/octet-stream";
}

function contentDisposition(disposition: "inline" | "attachment", fileName: string) {
  const safeName = fileName.replace(/[\\"]/g, "_");
  return `${disposition}; filename="${safeName}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;
}

export async function GET(
  request: Request,
  context: { params: Promise<{ key: string[] }> },
) {
  const session = await getSessionUser();
  if (session.status !== "ok") {
    return NextResponse.json(
      { ok: false, error: session.status },
      { status: statusCodeForSessionState(session.status) },
    );
  }

  const { key: keyParts } = await context.params;
  const key = keyParts.map(decodeURIComponent).join("/");
  if (!key) {
    return NextResponse.json({ ok: false, error: "Archivo no encontrado." }, { status: 404 });
  }

  const fileName = decodeURIComponent(key.split("/").pop() || "archivo");
  const contentType = inferMimeType(key);
  const url = new URL(request.url);
  const disposition = url.searchParams.get("download") === "1" ? "attachment" : "inline";

  try {
    const signedUrl = getSignedContentBucketGetUrl({
      key,
      fileName,
      contentType,
      disposition,
    });

    return NextResponse.redirect(signedUrl, {
      status: 302,
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch {
    const fallbackUrl = buildContentBucketPublicUrl(key);
    if (fallbackUrl.startsWith("http")) {
      const upstream = await fetch(fallbackUrl, { cache: "no-store" });
      if (!upstream.ok || !upstream.body) {
        return NextResponse.json(
          { ok: false, error: "No fue posible leer el archivo del bucket." },
          { status: upstream.status || 502 },
        );
      }

      return new NextResponse(upstream.body, {
        status: upstream.status,
        headers: {
          "Cache-Control": "private, no-store",
          "Content-Disposition": contentDisposition(disposition, fileName),
          "Content-Type": contentType,
        },
      });
    }
    return NextResponse.json(
      { ok: false, error: "Bucket content no configurado para URLs firmadas." },
      { status: 503 },
    );
  }
}
