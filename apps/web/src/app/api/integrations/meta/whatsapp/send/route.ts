import { NextResponse } from "next/server";

import { getSessionUser } from "@/lib/authz";
import { sendWhatsAppCloudMessage } from "@/lib/meta-whatsapp";

export const dynamic = "force-dynamic";

function statusCodeForSessionState(status: "unauthenticated" | "forbidden" | "inactive" | "ok") {
  if (status === "ok") return 200;
  if (status === "unauthenticated") return 401;
  return 403;
}

export async function POST(request: Request) {
  const session = await getSessionUser();
  if (session.status !== "ok") {
    return NextResponse.json({ ok: false, error: session.status }, { status: statusCodeForSessionState(session.status) });
  }

  const body = (await request.json().catch(() => null)) as
    | {
        contactName?: string;
        to?: string;
        waId?: string | null;
        bsuid?: string | null;
        parentBsuid?: string | null;
        whatsappUsername?: string | null;
        profilePictureUrl?: string | null;
        text?: string;
        phoneNumberId?: string;
        messageType?: "text" | "template" | "image" | "document";
        templateName?: string;
        templateLanguage?: string;
        templateBodyVariables?: string[];
        mediaId?: string;
        mediaCaption?: string;
        fileName?: string;
      }
    | null;

  const to = String(body?.to ?? "").trim();
  const text = String(body?.text ?? "").trim();
  const messageType = body?.messageType ?? "text";

  if (!to) {
    return NextResponse.json({ ok: false, error: "missing_to" }, { status: 400 });
  }

  try {
    const payload =
      messageType === "template"
        ? {
            type: "template" as const,
            templateName: String(body?.templateName ?? "").trim(),
            language: String(body?.templateLanguage ?? "en_US").trim(),
            bodyVariables: Array.isArray(body?.templateBodyVariables)
              ? body.templateBodyVariables.map((item) => String(item ?? "").trim()).filter(Boolean)
              : [],
          }
        : messageType === "image" || messageType === "document"
          ? {
              type: messageType,
              mediaId: String(body?.mediaId ?? "").trim(),
              caption: String(body?.mediaCaption ?? "").trim() || null,
              filename: String(body?.fileName ?? "").trim() || null,
            }
          : {
              type: "text" as const,
              text,
            };

    if (payload.type === "text" && !payload.text) {
      return NextResponse.json({ ok: false, error: "missing_text" }, { status: 400 });
    }

    if (payload.type === "template" && !payload.templateName) {
      return NextResponse.json({ ok: false, error: "missing_template_name" }, { status: 400 });
    }

    if ((payload.type === "image" || payload.type === "document") && !payload.mediaId) {
      return NextResponse.json({ ok: false, error: "missing_media_id" }, { status: 400 });
    }

    const result = await sendWhatsAppCloudMessage({
      userId: session.user.id,
      to,
      phoneNumberId: body?.phoneNumberId,
      contactName: body?.contactName,
      waId: body?.waId ?? null,
      bsuid: body?.bsuid ?? null,
      parentBsuid: body?.parentBsuid ?? null,
      whatsappUsername: body?.whatsappUsername ?? null,
      profilePictureUrl: body?.profilePictureUrl ?? null,
      profileSource: "waba_tab",
      payload,
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "meta_send_failed",
      },
      { status: 500 },
    );
  }
}
