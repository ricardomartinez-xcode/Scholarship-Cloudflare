import { randomUUID } from "node:crypto";

import { NextResponse } from "next/server";
import { z } from "zod";

import { getSessionUser } from "@/lib/authz";
import { isCloudflareRuntime } from "@/lib/cloudflare/runtime";
import {
  applyExtensionCampaignRepair,
  previewExtensionCampaignRepair,
} from "@/services/extensionCampaignRepairService";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const repairBodySchema = z.object({
  mode: z.enum(["preview", "apply"]).default("preview"),
  campaignId: z.string().trim().optional().nullable(),
  staleClaimAfterMs: z.number().int().positive().optional().nullable(),
  allowGlobalApply: z.boolean().optional().default(false),
});

function statusCodeForSessionState(status: "unauthenticated" | "forbidden" | "inactive" | "ok") {
  if (status === "ok") return 200;
  if (status === "unauthenticated") return 401;
  return 403;
}

function buildRequestId() {
  return `ext_campaign_repair_${Date.now()}_${randomUUID().slice(0, 8)}`;
}

export async function POST(request: Request) {
  const requestId = buildRequestId();
  const session = await getSessionUser();
  if (session.status !== "ok") {
    return NextResponse.json(
      { ok: false, requestId, error: session.status },
      { status: statusCodeForSessionState(session.status) },
    );
  }

  const rawBody = await request.json().catch(() => null);
  const payload = repairBodySchema.safeParse(rawBody);
  if (!payload.success) {
    return NextResponse.json(
      {
        ok: false,
        requestId,
        error: "Cuerpo inválido para reparación de campañas.",
        details: payload.error.flatten(),
      },
      { status: 400 },
    );
  }

  const campaignId =
    typeof payload.data.campaignId === "string"
      ? payload.data.campaignId.trim()
      : "";
  if (payload.data.campaignId != null && !campaignId) {
    return NextResponse.json(
      {
        ok: false,
        requestId,
        error: "campaignId vacío. Usa un id válido o elimínalo por completo.",
      },
      { status: 400 },
    );
  }

  const scope = campaignId ? "campaign" : "global";

  if (isCloudflareRuntime()) {
    return NextResponse.json({
      ok: true,
      requestId,
      mode: payload.data.mode,
      scope,
      report: {
        ok: true,
        source: "cloudflare-d1",
        repaired: false,
        campaignsAnalyzed: 0,
        actions: [],
        message:
          "Las campañas Cloudflare usan recuperación perezosa de claims en /api/ext/campaigns/claim; no se requiere reparación Prisma.",
      },
    });
  }

  try {
    const mode = payload.data.mode;
    if (mode === "apply" && scope === "global" && !payload.data.allowGlobalApply) {
      return NextResponse.json(
        {
          ok: false,
          requestId,
          error: "Debes enviar allowGlobalApply=true para aplicar una reparación global.",
        },
        { status: 400 },
      );
    }

    if (mode === "apply") {
      const report = await applyExtensionCampaignRepair({
        userId: session.user.id,
        requestId,
        campaignId: campaignId || null,
        staleClaimAfterMs: payload.data.staleClaimAfterMs ?? undefined,
      });
      return NextResponse.json({ ok: true, requestId, mode, scope, report });
    }

    const report = await previewExtensionCampaignRepair({
      userId: session.user.id,
      requestId,
      campaignId: campaignId || null,
      staleClaimAfterMs: payload.data.staleClaimAfterMs ?? undefined,
    });
    return NextResponse.json({ ok: true, requestId, mode, scope, report });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "No fue posible ejecutar diagnóstico/reparación de campañas.";
    const status = message.includes("no existe") ? 404 : 400;
    return NextResponse.json(
      {
        ok: false,
        requestId,
        error: message,
      },
      { status },
    );
  }
}

