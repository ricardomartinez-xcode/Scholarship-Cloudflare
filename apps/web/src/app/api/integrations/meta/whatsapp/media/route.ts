import { NextResponse } from "next/server";

import { getSessionUser } from "@/lib/authz";
import { uploadWhatsAppMedia } from "@/lib/meta-whatsapp";

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

  try {
    const formData = await request.formData();
    const file = formData.get("file");
    const phoneNumberId = String(formData.get("phoneNumberId") ?? "").trim() || null;

    if (!(file instanceof File)) {
      return NextResponse.json({ ok: false, error: "missing_file" }, { status: 400 });
    }

    const metadata = await uploadWhatsAppMedia({
      userId: session.user.id,
      file,
      fileName: file.name || "upload.bin",
      fileType: file.type || "application/octet-stream",
      phoneNumberId,
    });

    return NextResponse.json({ ok: true, media: metadata }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "meta_media_upload_failed",
      },
      { status: 500 },
    );
  }
}
