import { NextResponse } from "next/server";

import { getSessionUser } from "@/lib/authz";
import { renderActiveExtensionWhatsappDraft } from "@/lib/extension-whatsapp";

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

  const body = (await request.json().catch(() => null)) as
    | {
        quote?: {
          campus?: string | null;
          businessLine?: string | null;
          modality?: string | null;
          plan?: number | string | null;
          enrollmentType?: string | null;
          program?: string | null;
          totalMxn?: number | null;
          basePriceMxn?: number | null;
          scholarshipPercent?: number | null;
          firstPaymentAmountMxn?: number | null;
          additionalBenefitDuration?: string | null;
          additionalBenefitNotes?: string | null;
        } | null;
      }
    | null;

  const draft = await renderActiveExtensionWhatsappDraft({
    userId: session.user.id,
    quote: body?.quote ?? {},
  });

  return NextResponse.json({
    ok: true,
    ...draft,
  });
}
