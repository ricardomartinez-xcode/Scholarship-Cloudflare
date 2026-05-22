import { NextResponse } from "next/server";

import { getSessionUser } from "@/lib/authz";
import {
  deleteExtensionCampaignForUser,
  forcePauseExtensionCampaign,
  pauseExtensionCampaign,
  resumeExtensionCampaign,
} from "@/lib/extension-automation";

export const dynamic = "force-dynamic";

function statusCodeForSessionState(status: "unauthenticated" | "forbidden" | "inactive" | "ok") {
  if (status === "ok") return 200;
  if (status === "unauthenticated") return 401;
  return 403;
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ campaignId: string }> },
) {
  const session = await getSessionUser();
  if (session.status !== "ok") {
    return NextResponse.json(
      { ok: false, error: session.status },
      { status: statusCodeForSessionState(session.status) },
    );
  }

  const { campaignId } = await context.params;
  const body = (await request.json().catch(() => null)) as
    | {
        action?: "pause" | "resume" | "force_pause";
      }
    | null;

  try {
    const action = String(body?.action ?? "").trim().toLowerCase();
    if (action !== "pause" && action !== "resume" && action !== "force_pause") {
      return NextResponse.json(
        { ok: false, error: "La acción solicitada no es válida." },
        { status: 400 },
      );
    }

    const campaign =
      action === "force_pause"
        ? await forcePauseExtensionCampaign({
            userId: session.user.id,
            campaignId,
          })
        : action === "pause"
        ? await pauseExtensionCampaign({
            userId: session.user.id,
            campaignId,
          })
        : await resumeExtensionCampaign({
            userId: session.user.id,
            campaignId,
          });

    return NextResponse.json({
      ok: true,
      campaign,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "No fue posible actualizar la campaña de extensión.",
      },
      { status: 400 },
    );
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ campaignId: string }> },
) {
  const session = await getSessionUser();
  if (session.status !== "ok") {
    return NextResponse.json(
      { ok: false, error: session.status },
      { status: statusCodeForSessionState(session.status) },
    );
  }

  const { campaignId } = await context.params;

  try {
    const result = await deleteExtensionCampaignForUser({
      userId: session.user.id,
      campaignId,
    });

    return NextResponse.json({
      ok: true,
      deleted: true,
      campaignId: result.id,
      campaignName: result.campaignName,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "No fue posible eliminar la campaña de extensión.",
      },
      { status: 400 },
    );
  }
}
